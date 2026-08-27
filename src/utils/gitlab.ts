import { GITLAB, CORS_PROXIES } from '../config';
import { fetchWithTimeout, proxiedUrl } from './fetch';
import {
  classifyText,
  extractCodeBlocks,
  splitHtmlCode,
  decodeBase64,
  basename,
  pickHtmlFile,
  README_CANDIDATES,
} from './codeUtils';
import type { HostCode, HostStatus } from './codeUtils';

/**
 * GitLab 链接智能解析
 * 支持：仓库根目录（README）、-/blob / -/raw 文件、-/tree 文件夹/分支、自托管实例
 * 项目路径可为多级命名空间（组/子组/项目），如 group/sub/project
 * 请求链路：直连 → 同源代理 /gitlab-api（gitlab.com）→ 公共 CORS 代理
 */

interface GitlabTarget {
  /** 完整项目路径（可含 /） */
  project: string;
  ref: string;
  path: string;
}

/** 判断是否为 GitLab 链接：gitlab.com / *.gitlab.com / 自托管实例（路径含 GitLab 特有的 /-/ 段） */
export function isGitlabUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) return true;
  const pathname = new URL(url).pathname;
  return /\/-\/(?:blob|raw|blame|tree|commits|edit)\//i.test(pathname);
}

/** 取 URL 路径部分（不含 query/hash） */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** 计算 API 基础地址：gitlab.com 用官方，自托管实例用同源 /api/v4 */
function apiBaseFor(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() === 'gitlab.com') return GITLAB.api;
    return `${u.protocol}//${u.host}/api/v4`;
  } catch {
    return GITLAB.api;
  }
}

/**
 * 拆分 GitLab 路径：/-/ 之前为项目路径（多级命名空间），之后为动作与路径
 * 如 /group/sub/project/-/blob/main/README.md → head=group/sub/project, rest=/blob/main/README.md
 */
function splitGitlab(url: string): { head: string; rest: string | null } {
  const pathname = pathOf(url).replace(/\/+$/, '');
  const idx = pathname.indexOf('/-/');
  if (idx < 0) return { head: pathname.replace(/^\/+/, ''), rest: null };
  return { head: pathname.slice(1, idx), rest: pathname.slice(idx + 3) };
}

function parseGitlabFile(url: string): GitlabTarget | null {
  const { head, rest } = splitGitlab(url);
  if (!rest) return null;
  const m = rest.match(/^\/(?:blob|raw|blame)\/([^/]+)\/(.+)/);
  if (!m) return null;
  const path = m[2].replace(/\/+$/, '');
  if (!path || !head) return null;
  return { project: head, ref: m[1], path };
}

function parseGitlabTree(url: string): GitlabTarget | null {
  const { head, rest } = splitGitlab(url);
  if (!rest) return null;
  const m = rest.match(/^\/tree\/([^/]+)(?:\/(.*))?$/);
  if (!m) return null;
  return { project: head, ref: m[1], path: (m[2] ?? '').replace(/\/+$/, '') };
}

function parseGitlabRoot(url: string): { project: string } | null {
  const { head } = splitGitlab(url);
  if (!head) return null;
  return { project: head };
}

/** 链接展示描述 */
export function describeGitlabUrl(url: string): string {
  const file = parseGitlabFile(url);
  if (file) return `GitLab 文件 · ${file.project}/${file.path}`;
  const tree = parseGitlabTree(url);
  if (tree) {
    return tree.path ? `GitLab 文件夹 · ${tree.project}/${tree.path}` : `GitLab 仓库 · ${tree.project}`;
  }
  const root = parseGitlabRoot(url);
  if (root) return `GitLab 仓库 · ${root.project}`;
  return 'GitLab 链接';
}

/** 项目标识：完整路径 URL 编码（GitLab 用 {namespace}%2F{project} 定位项目） */
function projectId(project: string): string {
  return encodeURIComponent(project);
}

/** GitLab API JSON 请求：直连 → 同源代理（gitlab.com）→ 公共 CORS 代理 */
async function gitlabFetchJson(url: string, onStatus?: HostStatus): Promise<unknown> {
  const sameOrigin = url.startsWith(GITLAB.api)
    ? url.replace('https://gitlab.com', GITLAB.proxyPrefix)
    : null;
  let lastStatus = 0;
  for (const u of sameOrigin ? [url, sameOrigin] : [url]) {
    try {
      const res = await fetchWithTimeout(u);
      lastStatus = res.status;
      if (res.ok) return await res.json();
    } catch {
      /* 网络失败，尝试下一个 */
    }
  }
  if (lastStatus === 404) throw new Error('GitLab 项目或文件不存在（404）');
  if (lastStatus === 401) throw new Error('GitLab 项目需要登录或未公开');
  onStatus?.('GitLab 直连失败，尝试公共代理…');
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetchWithTimeout(proxiedUrl(url, proxy));
      if (res.ok) return await res.json();
    } catch {
      /* 尝试下一个 */
    }
  }
  throw new Error('GitLab 访问失败，请检查网络或稍后重试');
}

/** 获取仓库默认分支 */
async function fetchDefaultBranch(
  apiBase: string,
  project: string,
  ref: string,
  onStatus?: HostStatus,
): Promise<string> {
  if (ref) return ref;
  try {
    const data = (await gitlabFetchJson(
      `${apiBase}/projects/${projectId(project)}`,
      onStatus,
    )) as { default_branch?: string };
    if (data.default_branch) return data.default_branch;
  } catch (err) {
    // 项目级错误（不存在/未公开）直接透传，网络类错误才回退 master
    if (err instanceof Error && /(404|401|不存在|登录|未公开)/.test(err.message)) throw err;
  }
  return 'master';
}

/** 获取仓库文件树（recursive，可按目录限定；分页拉全） */
async function fetchTreeFiles(
  apiBase: string,
  project: string,
  ref: string,
  basePath: string,
  onStatus?: HostStatus,
): Promise<Array<{ path: string; type: string }>> {
  const all: Array<{ path: string; type: string }> = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ ref, recursive: 'true', per_page: '100', page: String(page) });
    if (basePath) params.set('path', basePath);
    const data = (await gitlabFetchJson(
      `${apiBase}/projects/${projectId(project)}/repository/tree?${params.toString()}`,
      onStatus,
    )) as Array<{ path?: string; type?: string }> | { message?: string };
    if (!Array.isArray(data)) {
      const msg = data && typeof data === 'object' && 'message' in data ? data.message : '';
      throw new Error(msg ? `GitLab：${msg}` : '无法获取 GitLab 仓库文件列表');
    }
    for (const f of data) {
      if (f && typeof f.path === 'string') {
        all.push({ path: f.path as string, type: f.type === 'tree' ? 'tree' : 'blob' });
      }
    }
    if (data.length < 100) break;
  }
  return all;
}

/** 获取单个文件文本内容（repository/files API，base64 解码） */
async function fetchFileText(
  apiBase: string,
  project: string,
  ref: string,
  path: string,
  onStatus?: HostStatus,
): Promise<string> {
  const encodedPath = encodeURIComponent(path);
  const data = (await gitlabFetchJson(
    `${apiBase}/projects/${projectId(project)}/repository/files/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    onStatus,
  )) as { content?: string; encoding?: string };
  if (typeof data.content !== 'string') throw new Error('GitLab 文件内容获取失败');
  return data.encoding === 'base64' ? decodeBase64(data.content) : data.content;
}

/** 解析 GitLab 链接并抓取代码 */
export async function fetchGitlabCode(url: string, onStatus?: HostStatus): Promise<HostCode> {
  const apiBase = apiBaseFor(url);

  const file = parseGitlabFile(url);
  if (file) {
    onStatus?.(`连接 GitLab：${file.project}`);
    const text = await fetchFileText(apiBase, file.project, file.ref, file.path, onStatus);
    return classifyText(text, basename(file.path), `${file.project}/${file.path}`);
  }

  const tree = parseGitlabTree(url);
  const root = parseGitlabRoot(url) ?? (tree ? { project: tree.project } : null);
  if (!root) throw new Error('无法识别的 GitLab 链接');

  const { project } = root;
  onStatus?.(`连接 GitLab：${project}`);
  const ref = await fetchDefaultBranch(apiBase, project, tree?.ref ?? '', onStatus);
  const basePath = tree?.path ?? '';

  // 1. 优先读取仓库文件树，找到 HTML 源码文件直接抓取源码
  try {
    onStatus?.('读取仓库文件列表');
    const files = await fetchTreeFiles(apiBase, project, ref, basePath, onStatus);
    const htmlFile = pickHtmlFile(files, basePath);
    if (htmlFile) {
      onStatus?.(`找到 HTML 源码 ${htmlFile}`);
      const text = await fetchFileText(apiBase, project, ref, htmlFile, onStatus);
      const { html, css, js } = splitHtmlCode(text);
      return { html, css, js, source: `${project}/${htmlFile}` };
    }
  } catch {
    /* 文件列表失败则回退 README 流程 */
  }

  // 2. 无 HTML 源码 → 从 README 提取代码块；无代码块则整篇作为文档
  onStatus?.('未找到 HTML 源码，查找 README');
  for (const name of README_CANDIDATES) {
    try {
      const path = basePath ? `${basePath}/${name}` : name;
      const text = await fetchFileText(apiBase, project, ref, path, onStatus);
      const blocks = extractCodeBlocks(text);
      if (blocks.html || blocks.css || blocks.js) {
        onStatus?.(`从 ${name} 提取到代码块`);
        return { html: blocks.html, css: blocks.css, js: blocks.js, source: project };
      }
      onStatus?.(`${name} 无代码块，作为文档填入`);
      return classifyText(text, name, project);
    } catch {
      /* 尝试下一个 README 名称 */
    }
  }
  throw new Error(`未在 ${project} 找到可用的源码或 README`);
}
