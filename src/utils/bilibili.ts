import { BILIBILI, CODEPEN, GITHUB, NETDISK_HOSTS, CODE_HOSTS } from '../config';
import { fetchWithTimeout, proxiedUrl, isTimeoutError } from './fetch';
import type { ParsedLink } from '../types';

/**
 * B 站链接智能解析
 * 1. 提取 BV 号
 * 2. 调用 B 站公开 API 获取视频简介与 UP 主信息
 * 3. 调用热评 API 获取前 N 条热评
 * 4. 从简介与评论中提取 URL，过滤出代码托管站点与网盘链接
 * 5. 用户选择后自动抓取代码（CodePen / GitHub Gist / 其他）
 */

/** 从 URL 中提取 BV 号 */
export function extractBV(url: string): string | null {
  const match = url.match(/BV[0-9A-Za-z]{10}/);
  return match ? match[0] : null;
}

/** 判断是否为 B 站链接 */
export function isBilibiliUrl(url: string): boolean {
  return /(^|\.)bilibili\.com\//.test(url) || /(^|\.)b23\.tv\//.test(url);
}

/** 带 CORS 代理降级的 JSON 请求 */
async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    if (!isTimeoutError(err)) {
      // 直接请求失败（多为 CORS），尝试公共代理
      const proxied = await fetchWithTimeout(proxiedUrl(url, BILIBILI.corsProxy));
      if (proxied.ok) {
        return await proxied.json();
      }
    }
  }
  throw new Error('请求失败，请检查网络或稍后重试');
}

export interface BiliVideoInfo {
  bvid: string;
  aid: number;
  title: string;
  desc: string;
  owner: string;
}

/** 获取视频信息 */
export async function fetchVideoInfo(bvid: string): Promise<BiliVideoInfo> {
  const data = (await fetchJson(`${BILIBILI.viewApi}?bvid=${bvid}`)) as {
    code: number;
    data?: { aid: number; title: string; desc: string; owner?: { name: string } };
  };
  if (data.code !== 0 || !data.data) {
    throw new Error('视频信息获取失败，可能链接无效');
  }
  return {
    bvid,
    aid: data.data.aid,
    title: data.data.title,
    desc: data.data.desc,
    owner: data.data.owner?.name ?? '未知 UP 主',
  };
}

/** 获取热评文本列表 */
export async function fetchHotComments(aid: number, count = BILIBILI.replyCount): Promise<string[]> {
  try {
    const data = (await fetchJson(
      `${BILIBILI.replyApi}?type=1&oid=${aid}&mode=3`,
    )) as {
      code: number;
      data?: { replies?: Array<{ content?: { message?: string } }> };
    };
    if (data.code !== 0 || !data.data?.replies) {
      return [];
    }
    return data.data.replies
      .slice(0, count)
      .map((r) => r.content?.message ?? '')
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 从文本中提取所有 URL */
export function extractUrls(text: string): string[] {
  const regex = /https?:\/\/[^\s"'<>，。；、）】]+/g;
  const found = text.match(regex) ?? [];
  return [...new Set(found.map((u) => u.replace(/[),.;]+$/, '')))];
}

/** 识别链接类型 */
export function classifyLink(url: string): ParsedLink['type'] {
  const host = new URL(url).hostname.toLowerCase();
  if (NETDISK_HOSTS.some((h) => host.includes(h))) return 'netdisk';
  if (CODE_HOSTS.some((h) => host.includes(h))) return 'code';
  return 'other';
}

/** 从链接文本中提取网盘提取码（常见格式：提取码/密码 xxxx） */
export function extractPassword(text: string, url: string): string | undefined {
  const match = text.match(/(?:提取码|密码|pwd|code)[:：\s]*([0-9A-Za-z]{4,8})/i);
  if (match) return match[1];
  const hash = new URL(url).hash;
  const hashMatch = hash.match(/[0-9A-Za-z]{4,8}$/);
  return hashMatch ? hashMatch[0] : undefined;
}

/** 解析 B 站链接，返回候选链接列表 */
export async function parseBilibili(url: string): Promise<{ info: BiliVideoInfo; links: ParsedLink[] }> {
  const bvid = extractBV(url);
  if (!bvid) {
    throw new Error('未识别到有效的 BV 号');
  }
  const info = await fetchVideoInfo(bvid);
  const comments = await fetchHotComments(info.aid);

  const texts = [info.desc, ...comments];
  const rawUrls = texts.flatMap(extractUrls);

  const links: ParsedLink[] = [];
  const seen = new Set<string>();
  for (const raw of rawUrls) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    const type = classifyLink(raw);
    if (type === 'other') continue;
    const password = extractPassword(texts.join('\n'), raw);
    links.push({
      url: raw,
      label: new URL(raw).hostname,
      type,
      password,
    });
  }
  return { info, links };
}

/** 从 CodePen 链接提取 pen id */
function extractPenId(url: string): string | null {
  const match = url.match(/codepen\.io\/[^/]+\/(?:pen|full|debug)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/** 从 Gist 链接提取 gist id */
function extractGistId(url: string): string | null {
  const match = url.match(/gist\.github\.com\/[^/]+\/([0-9a-f]+)/);
  return match ? match[1] : null;
}

export interface FetchedCode {
  html: string;
  css: string;
  js: string;
  source: string;
}

/** 抓取 CodePen 代码 */
async function fetchCodePen(penId: string): Promise<FetchedCode> {
  const url = `${CODEPEN.api}${penId}`;
  const data = (await fetchJson(url)) as {
    data?: { html?: string; css?: string; js?: string; title?: string };
  };
  const d = data.data;
  if (!d) throw new Error('CodePen 解析失败');
  return { html: d.html ?? '', css: d.css ?? '', js: d.js ?? '', source: d.title ?? 'CodePen' };
}

/** 抓取 GitHub Gist 代码 */
async function fetchGist(gistId: string): Promise<FetchedCode> {
  const data = (await fetchJson(`${GITHUB.gistApi}${gistId}`)) as {
    files?: Record<string, { content?: string; language?: string | null }>;
    description?: string;
  };
  if (!data.files) throw new Error('Gist 获取失败');
  const files = Object.values(data.files);
  const pick = (langs: string[]): string => {
    const f = files.find((f) => f.language && langs.includes(f.language));
    return f?.content ?? '';
  };
  return {
    html: pick(['HTML', 'HTML+ERB', 'XML']),
    css: pick(['CSS', 'SCSS', 'Less', 'Sass']),
    js: pick(['JavaScript', 'TypeScript', 'JSX', 'TSX']),
    source: data.description ?? 'Gist',
  };
}

/** 根据链接抓取代码 */
export async function fetchCodeFromLink(link: ParsedLink): Promise<FetchedCode> {
  const host = new URL(link.url).hostname.toLowerCase();
  if (host.includes('codepen.io')) {
    const penId = extractPenId(link.url);
    if (!penId) throw new Error('无法解析 CodePen 链接');
    return fetchCodePen(penId);
  }
  if (host.includes('gist.github.com')) {
    const gistId = extractGistId(link.url);
    if (!gistId) throw new Error('无法解析 Gist 链接');
    return fetchGist(gistId);
  }
  // 网盘或其他站点：暂不支持自动抓取，返回空并提示
  throw new Error('该链接暂不支持自动抓取，请手动复制代码');
}
