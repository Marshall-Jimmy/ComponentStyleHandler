import { GITEE, CORS_PROXIES } from '../config';
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
 * Gitee 链接智能解析
 * 支持：仓库根目录（README）、blob/raw 文件、tree 文件夹/分支
 * 请求链路：直连 → Vite 同源代理 /gitee-api → 公共 CORS 代理
 */

interface GiteeTarget {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

/** 判断是否为 Gitee 链接 */
export function isGiteeUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === 'gitee.com' || host.endsWith('.gitee.com');
}

function parseGiteeRoot(url: string): { owner: string; repo: string } | null {
  const m = url.match(/gitee\.com\/([^/]+)\/([^/]+?)\/?$/);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

function parseGiteeFile(url: string): GiteeTarget | null {
  const m = url.match(/gitee\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/?(.*)/);
  if (!m) return null;
  const path = m[4].replace(/\/+$/, '');
  if (!path) return null;
  return { owner: m[1], repo: m[2], ref: m[3], path };
}

function parseGiteeTree(url: string): GiteeTarget | null {
  const m = url.match(/gitee\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/?(.*)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3], path: m[4].replace(/\/+$/, '') };
}

/** 链接展示描述 */
export function describeGiteeUrl(url: string): string {
  const file = parseGiteeFile(url);
  if (file) return `Gitee 文件 · ${file.owner}/${file.repo}/${file.path}`;
  const tree = parseGiteeTree(url);
  if (tree) {
    return tree.path
      ? `Gitee 文件夹 · ${tree.owner}/${tree.repo}/${tree.path}`
      : `Gitee 仓库 · ${tree.owner}/${tree.repo}`;
  }
  const root = parseGiteeRoot(url);
  if (root) return `Gitee 仓库 · ${root.owner}/${root.repo}`;
  return 'Gitee 链接';
}

/** Gitee API JSON 请求：直连 → 同源代理 → 公共 CORS 代理 */
async function giteeFetchJson(url: string, onStatus?: HostStatus): Promise<unknown> {
  const sameOrigin = url.replace('https://gitee.com', GITEE.proxyPrefix);
  let lastStatus = 0;
  for (const u of [url, sameOrigin]) {
    try {
      const res = await fetchWithTimeout(u);
      lastStatus = res.status;
      if (res.ok) return await res.json();
    } catch {
      /* 网络失败，尝试下一个 */
    }
  }
  if (lastStatus === 404) throw new Error('Gitee 仓库或文件不存在（404）');
  if (lastStatus === 401) throw new Error('Gitee 仓库需要登录或未公开');
  onStatus?.('Gitee 直连与同源代理失败，尝试公共代理…');
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetchWithTimeout(proxiedUrl(url, proxy));
      if (res.ok) return await res.json();
    } catch {
      /* 尝试下一个 */
    }
  }
  throw new Error('Gitee 访问失败，请检查网络或稍后重试');
}

/** 获取仓库默认分支 */
async function fetchDefaultBranch(
  owner: string,
  repo: string,
  ref: string,
  onStatus?: HostStatus,
): Promise<string> {
  if (ref) return ref;
  try {
    const data = (await giteeFetchJson(
      `${GITEE.api}/repos/${owner}/${repo}`,
      onStatus,
    )) as { default_branch?: string };
    if (data.default_branch) return data.default_branch;
  } catch (err) {
    // 仓库级错误（不存在/未公开）直接透传，网络类错误才回退 master
    if (err instanceof Error && /(404|401|不存在|登录|未公开)/.test(err.message)) throw err;
  }
  return 'master';
}

/** 获取仓库文件树（recursive） */
async function fetchTreeFiles(
  owner: string,
  repo: string,
  ref: string,
  onStatus?: HostStatus,
): Promise<Array<{ path: string; type: string }>> {
  const data = (await giteeFetchJson(
    `${GITEE.api}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    onStatus,
  )) as { tree?: Array<{ path?: string; type?: string }> };
  const tree = data.tree;
  if (!Array.isArray(tree)) throw new Error('无法获取 Gitee 仓库文件列表');
  return tree
    .filter((f) => f && typeof f.path === 'string')
    .map((f) => ({ path: f.path as string, type: f.type ?? 'blob' }));
}

/** 获取单个文件文本内容（contents API，base64 解码） */
async function fetchFileText(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  onStatus?: HostStatus,
): Promise<string> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const data = (await giteeFetchJson(
    `${GITEE.api}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    onStatus,
  )) as { content?: string; encoding?: string };
  if (typeof data.content !== 'string') throw new Error('Gitee 文件内容获取失败');
  return data.encoding === 'base64' ? decodeBase64(data.content) : data.content;
}

/** 解析 Gitee 链接并抓取代码 */
export async function fetchGiteeCode(url: string, onStatus?: HostStatus): Promise<HostCode> {
  const file = parseGiteeFile(url);
  if (file) {
    onStatus?.(`连接 Gitee：${file.owner}/${file.repo}`);
    const text = await fetchFileText(file.owner, file.repo, file.ref, file.path, onStatus);
    return classifyText(text, basename(file.path), `${file.owner}/${file.repo}/${file.path}`);
  }

  const tree = parseGiteeTree(url);
  const root = parseGiteeRoot(url) ?? (tree ? { owner: tree.owner, repo: tree.repo } : null);
  if (!root) throw new Error('无法识别的 Gitee 链接');

  const { owner, repo } = root;
  onStatus?.(`连接 Gitee：${owner}/${repo}`);
  const ref = await fetchDefaultBranch(owner, repo, tree?.ref ?? '', onStatus);
  const basePath = tree?.path ?? '';

  // 1. 优先读取仓库文件树，找到 HTML 源码文件直接抓取源码
  try {
    onStatus?.('读取仓库文件列表');
    const files = await fetchTreeFiles(owner, repo, ref, onStatus);
    const htmlFile = pickHtmlFile(files, basePath);
    if (htmlFile) {
      onStatus?.(`找到 HTML 源码 ${htmlFile}`);
      const text = await fetchFileText(owner, repo, ref, htmlFile, onStatus);
      const { html, css, js } = splitHtmlCode(text);
      return { html, css, js, source: `${owner}/${repo}/${htmlFile}` };
    }
  } catch {
    /* 文件列表失败则回退 README 流程 */
  }

  // 2. 无 HTML 源码 → 从 README 提取代码块；无代码块则整篇作为文档
  onStatus?.('未找到 HTML 源码，查找 README');
  for (const name of README_CANDIDATES) {
    try {
      const path = basePath ? `${basePath}/${name}` : name;
      const text = await fetchFileText(owner, repo, ref, path, onStatus);
      const blocks = extractCodeBlocks(text);
      if (blocks.html || blocks.css || blocks.js) {
        onStatus?.(`从 ${name} 提取到代码块`);
        return { html: blocks.html, css: blocks.css, js: blocks.js, source: `${owner}/${repo}` };
      }
      onStatus?.(`${name} 无代码块，作为文档填入`);
      return classifyText(text, name, `${owner}/${repo}`);
    } catch {
      /* 尝试下一个 README 名称 */
    }
  }
  throw new Error(`未在 ${owner}/${repo} 找到可用的源码或 README`);
}
