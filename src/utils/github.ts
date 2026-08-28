import { GITHUB } from '../config';
import { fetchWithTimeout } from './fetch';
import {
  classifyText,
  extractCodeBlocks,
  splitHtmlCode,
  inlineDemoAssets,
  collectDemos,
  README_CANDIDATES,
} from './codeUtils';
import type { HostCode, HostStatus, RepoCollection, RepoDemo } from './codeUtils';

/**
 * GitHub 链接智能解析
 * 支持：仓库根目录（README）、blob/raw 文件、raw.githubusercontent 直链、Gist
 * 直连失败时自动切换到 gh-proxy.com 镜像站重试。
 */

export interface GitHubTarget {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

export type GitHubCode = HostCode;
export type GithubStatus = HostStatus;

/** 判断是否为 GitHub 链接（含 Gist / raw.githubusercontent），基于 hostname 精确匹配，兼容裸域名与子域名 */
export function isGithubUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === 'github.com' ||
    host.endsWith('.github.com') ||
    host === 'githubusercontent.com' ||
    host.endsWith('.githubusercontent.com')
  );
}

/** 判断是否为 Gist 链接 */
export function isGistUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === 'gist.github.com' || host.endsWith('.gist.github.com');
}

/** 从 Gist 链接提取 gist id */
function extractGistId(url: string): string | null {
  const match = url.match(/gist\.github\.com\/(?:[^/]+\/)?([0-9a-fA-F]{7,32})/);
  return match ? match[1] : null;
}

/** 解析仓库内文件路径（blob / raw / raw.githubusercontent） */
export function parseRepoPath(url: string): GitHubTarget | null {
  const m =
    url.match(/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)/) ??
    url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3], path: m[4] };
}

/** 解析仓库根目录 */
function parseRepoRoot(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+?)\/?$/);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

/** 识别仓库文件夹（tree 链接） */
function parseTreePath(url: string): GitHubTarget | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3], path: m[4] };
}

/** 链接展示描述 */
export function describeGithubUrl(url: string): string {
  const path = parseRepoPath(url);
  if (path) return `GitHub 文件 · ${path.owner}/${path.repo}/${path.path}`;
  const tree = parseTreePath(url);
  if (tree) return `GitHub 文件夹 · ${tree.owner}/${tree.repo}/${tree.path}`;
  const root = parseRepoRoot(url);
  if (root) return `GitHub 仓库 · ${root.owner}/${root.repo}`;
  if (isGistUrl(url)) return 'GitHub Gist';
  return 'GitHub 链接';
}

/** 通用 GitHub 请求：直连失败自动切换 gh-proxy.com 镜像 */
async function githubFetch(url: string, onStatus?: GithubStatus): Promise<Response> {
  try {
    const res = await fetchWithTimeout(url);
    if (res.ok) return res;
  } catch {
    /* 网络失败，尝试镜像 */
  }
  onStatus?.('GitHub 直连失败，切换 gh-proxy.com 镜像…');
  const mirror = `${GITHUB.mirrorPrefix}${url}`;
  const res2 = await fetchWithTimeout(mirror);
  if (res2.ok) return res2;
  throw new Error('GitHub 访问失败，直连与镜像均不可用');
}

async function fetchGithubText(url: string, onStatus?: GithubStatus): Promise<string> {
  const res = await githubFetch(url, onStatus);
  return res.text();
}

async function fetchGithubJson(url: string, onStatus?: GithubStatus): Promise<unknown> {
  const res = await githubFetch(url, onStatus);
  return res.json();
}

/** 获取仓库根目录文件列表（GitHub contents API） */
async function fetchRepoRootFiles(
  owner: string,
  repo: string,
  onStatus?: GithubStatus,
): Promise<Array<{ name: string; type: string }>> {
  const data = await fetchGithubJson(`https://api.github.com/repos/${owner}/${repo}/contents/`, onStatus);
  if (!Array.isArray(data)) throw new Error('无法获取仓库文件列表');
  return data
    .filter((f) => f && typeof f.name === 'string')
    .map((f) => ({ name: f.name as string, type: (f.type as string) ?? 'file' }));
}

/** 抓取 Gist 代码 */
async function fetchGist(url: string, onStatus?: GithubStatus): Promise<GitHubCode> {
  const id = extractGistId(url);
  if (!id) throw new Error('无法识别 Gist ID');
  onStatus?.('连接 GitHub：Gist');
  onStatus?.('获取 Gist 文件列表');
  const data = (await fetchGithubJson(`${GITHUB.gistApi}${id}`, onStatus)) as {
    files?: Record<string, { content?: string; language?: string | null }>;
    description?: string;
  };
  if (!data.files) throw new Error('Gist 获取失败，可能不存在或已删除');
  const files = Object.entries(data.files).map(([name, f]) => ({
    name,
    lang: f.language ?? '',
    content: f.content ?? '',
  }));
  const pick = (langs: string[]): string =>
    files.find((f) => langs.some((l) => f.lang.toLowerCase().includes(l)))?.content ?? '';
  const html = pick(['html', 'xml', 'markup']);
  const css = pick(['css', 'scss', 'sass', 'less']);
  const js = pick(['javascript', 'typescript', 'jsx', 'tsx', 'json', 'vue']);
  const fallback = files.find((f) => !html && !css && !js && f.content)?.content ?? '';
  return {
    html: html || (!css && !js ? fallback : ''),
    css,
    js,
    source: data.description || url,
  };
}

/**
 * 解析 GitHub 链接并抓取代码
 * @param onStatus 过程回调，透明展示每一步
 */
export async function fetchGitHubCode(url: string, onStatus?: GithubStatus): Promise<GitHubCode> {
  const path = parseRepoPath(url);
  if (path) {
    onStatus?.(`连接 GitHub：${path.owner}/${path.repo}`);
    onStatus?.('获取文件内容');
    const text = await fetchGithubText(
      `${GITHUB.rawHost}/${path.owner}/${path.repo}/${path.ref}/${path.path}`,
      onStatus,
    );
    if (/\.html?$/i.test(path.path)) {
      const dirPath = path.path.split('/').slice(0, -1).join('/');
      const fetchText = (p: string) =>
        fetchGithubText(
          `${GITHUB.rawHost}/${path.owner}/${path.repo}/${path.ref}/${encodeURIComponent(p)}`,
          onStatus,
        );
      const inline = await inlineDemoAssets(text, dirPath, fetchText);
      return {
        html: inline.html,
        css: inline.css,
        js: inline.js,
        source: `${path.owner}/${path.repo}/${path.path}`,
      };
    }
    return classifyText(text, path.path, `${path.owner}/${path.repo}/${path.path}`);
  }

  if (isGistUrl(url)) {
    return fetchGist(url, onStatus);
  }

  const tree = parseTreePath(url);
  if (tree) {
    onStatus?.(`连接 GitHub：${tree.owner}/${tree.repo}`);
    onStatus?.('文件夹内查找 README');
    for (const name of README_CANDIDATES) {
      try {
        const text = await fetchGithubText(
          `${GITHUB.rawHost}/${tree.owner}/${tree.repo}/${tree.ref}/${tree.path}/${name}`,
          onStatus,
        );
        const blocks = extractCodeBlocks(text);
        if (blocks.html || blocks.css || blocks.js) {
          return { html: blocks.html, css: blocks.css, js: blocks.js, source: `${tree.owner}/${tree.repo}/${tree.path}` };
        }
        return classifyText(text, name, `${tree.owner}/${tree.repo}/${tree.path}`);
      } catch {
        /* 尝试下一个 README 名称 */
      }
    }
    throw new Error('该文件夹下未找到 README，请粘贴具体文件链接');
  }

  const root = parseRepoRoot(url);
  if (root) {
    onStatus?.(`连接 GitHub：${root.owner}/${root.repo}`);
    // 1. 优先读取仓库根文件列表，找到 HTML 源码文件直接抓取源码
    try {
      onStatus?.('读取仓库文件列表');
      const files = await fetchRepoRootFiles(root.owner, root.repo, onStatus);
      const htmlFiles = files.filter((f) => f.type === 'file' && /\.html?$/i.test(f.name));
      if (htmlFiles.length > 0) {
        const pick = htmlFiles.find((f) => /^index\.html?$/i.test(f.name)) ?? htmlFiles[0];
        onStatus?.(`找到 HTML 源码 ${pick.name}`);
        const text = await fetchGithubText(
          `${GITHUB.rawHost}/${root.owner}/${root.repo}/HEAD/${encodeURIComponent(pick.name)}`,
          onStatus,
        );
        const { html, css, js } = splitHtmlCode(text);
        return { html, css, js, source: `${root.owner}/${root.repo}/${pick.name}` };
      }
    } catch {
      /* 文件列表获取失败则回退 README 流程 */
    }
    // 2. 无 HTML 源码 → 从 README 提取代码块；无代码块则整篇作为文档
    onStatus?.('未找到 HTML 源码，查找 README');
    for (const name of README_CANDIDATES) {
      try {
        const text = await fetchGithubText(
          `${GITHUB.rawHost}/${root.owner}/${root.repo}/HEAD/${name}`,
          onStatus,
        );
        const blocks = extractCodeBlocks(text);
        if (blocks.html || blocks.css || blocks.js) {
          onStatus?.(`从 ${name} 提取到代码块`);
          return { html: blocks.html, css: blocks.css, js: blocks.js, source: `${root.owner}/${root.repo}` };
        }
        onStatus?.(`${name} 无代码块，作为文档填入`);
        return classifyText(text, name, `${root.owner}/${root.repo}`);
      } catch {
        /* 尝试下一个 README 名称 */
      }
    }
    throw new Error(`未在 ${root.owner}/${root.repo} 找到可用的源码或 README`);
  }

  throw new Error('无法识别的 GitHub 链接');
}

/** 获取仓库完整文件树（git trees API，recursive 递归） */
async function fetchRepoTree(
  owner: string,
  repo: string,
  ref: string,
  onStatus?: GithubStatus,
): Promise<Array<{ path: string; type: string; size?: number }>> {
  const data = (await fetchGithubJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    onStatus,
  )) as { tree?: Array<{ path?: string; type?: string; size?: number }> };
  if (!Array.isArray(data.tree)) throw new Error('无法获取 GitHub 仓库文件列表');
  return data.tree
    .filter((f) => f && typeof f.path === 'string')
    .map((f) => ({ path: f.path as string, type: f.type === 'tree' ? 'tree' : 'blob', size: f.size }));
}

/** 列出仓库中的组件合集（多个 HTML Demo 按目录分组；文件/Gist 链接返回空集） */
export async function listGithubDemos(url: string, onStatus?: GithubStatus): Promise<RepoCollection> {
  if (parseRepoPath(url) || isGistUrl(url)) return { demos: [], ref: '' };
  const tree = parseTreePath(url);
  const root = parseRepoRoot(url) ?? (tree ? { owner: tree.owner, repo: tree.repo } : null);
  if (!root) throw new Error('无法识别的 GitHub 链接');
  const { owner, repo } = root;
  onStatus?.(`连接 GitHub：${owner}/${repo}`);
  const ref = tree?.ref ?? 'HEAD';
  const basePath = tree?.path ?? '';
  onStatus?.('读取仓库文件列表');
  const files = await fetchRepoTree(owner, repo, ref, onStatus);
  const demos = collectDemos(
    basePath
      ? files
          .filter((f) => f.path.startsWith(`${basePath}/`))
          .map((f) => ({ path: f.path.slice(basePath.length + 1), type: f.type }))
      : files,
  ).map((d) => ({ ...d, path: basePath ? `${basePath}/${d.path}` : d.path }));
  return { demos, ref };
}

/** 抓取单个 Demo：读取 index.html 并把相对外部 CSS/JS/SVG 内联为自包含代码 */
export async function fetchGithubDemo(
  url: string,
  demo: RepoDemo,
  onStatus?: GithubStatus,
): Promise<HostCode> {
  const tree = parseTreePath(url);
  const root = parseRepoRoot(url) ?? (tree ? { owner: tree.owner, repo: tree.repo } : null);
  if (!root) throw new Error('无法识别的 GitHub 链接');
  const { owner, repo } = root;
  const ref = tree?.ref ?? 'HEAD';
  onStatus?.(`抓取 ${demo.name}`);
  const fetchText = (p: string) =>
    fetchGithubText(`${GITHUB.rawHost}/${owner}/${repo}/${ref}/${encodeURIComponent(p)}`, onStatus);
  const html = await fetchText(demo.path);
  const dirPath = demo.path.split('/').slice(0, -1).join('/');
  const inline = await inlineDemoAssets(html, dirPath, fetchText);
  return { html: inline.html, css: inline.css, js: inline.js, source: `${owner}/${repo}/${demo.path}` };
}
