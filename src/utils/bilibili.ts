import { BILIBILI, CODEPEN, NETDISK_HOSTS, CODE_HOSTS } from '../config';
import { fetchJson, fetchWithTimeout } from './fetch';
import { isNetdiskUrl, fetchCodeFromNetdisk } from './netdisk';
import { isGithubUrl, fetchGitHubCode } from './github';
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

/** 判断是否为 B 站链接（基于 hostname，兼容裸域名与 www/b23.tv 短链） */
export function isBilibiliUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === 'bilibili.com' ||
    host.endsWith('.bilibili.com') ||
    host === 'b23.tv' ||
    host.endsWith('.b23.tv')
  );
}

export interface BiliVideoInfo {
  bvid: string;
  aid: number;
  title: string;
  desc: string;
  owner: string;
}

/**
 * 请求 B 站 API（同源代理优先，无 CORS 限制）
 * 1. Vite dev/preview 已把 /bili-api 反代到 api.bilibili.com，直接同源请求
 * 2. 失败则回退直连 + 公共 CORS 代理链
 */
async function fetchBiliApi<T>(apiBase: string, query: string): Promise<T> {
  const proxyUrl = `${BILIBILI.proxyPrefix}${apiBase.replace('https://api.bilibili.com', '')}?${query}`;
  try {
    const res = await fetchWithTimeout(proxyUrl);
    if (res.ok) {
      return (await res.json()) as T;
    }
  } catch {
    /* 回退直连 + CORS 代理 */
  }
  return (await fetchJson(`${apiBase}?${query}`)) as T;
}

/** 获取视频信息 */
export async function fetchVideoInfo(bvid: string): Promise<BiliVideoInfo> {
  const data = await fetchBiliApi<{
    code: number;
    data?: { aid: number; title: string; desc: string; owner?: { name: string } };
  }>(BILIBILI.viewApi, `bvid=${bvid}`);
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

/** 获取热评文本列表（旧版 x/v2/reply 接口，免 WBI 签名） */
export async function fetchHotComments(aid: number, count = BILIBILI.replyCount): Promise<string[]> {
  try {
    const data = await fetchBiliApi<{
      code: number;
      data?: { replies?: Array<{ content?: { message?: string } }> };
    }>(BILIBILI.replyApi, `type=1&oid=${aid}&sort=2`);
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

/** 从文本中提取所有 URL（截断末尾粘连的中文/非 URL 字符，如 "仓库链接"） */
export function extractUrls(text: string): string[] {
  const regex = /https?:\/\/[^\s"'<>，。；、）】]+/g;
  const found = text.match(regex) ?? [];
  const cleaned = found.map((u) =>
    u
      .replace(/[^A-Za-z0-9_~\-./:=?&#%+@!$'()*;,%]+$/g, '')
      .replace(/[),.;]+$/, ''),
  );
  return [...new Set(cleaned.filter(Boolean))];
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
export async function parseBilibili(
  url: string,
  onStatus?: (msg: string) => void,
): Promise<{ info: BiliVideoInfo; links: ParsedLink[] }> {
  const bvid = extractBV(url);
  if (!bvid) {
    throw new Error('未识别到有效的 BV 号');
  }
  onStatus?.('识别 B 站链接');
  const info = await fetchVideoInfo(bvid);
  onStatus?.('获取视频信息');
  const comments = await fetchHotComments(info.aid);
  onStatus?.('拉取热评');

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
  onStatus?.('提取候选链接');
  return { info, links };
}

/** 从 CodePen 链接提取 pen id */
function extractPenId(url: string): string | null {
  const match = url.match(/codepen\.io\/[^/]+\/(?:pen|full|debug)\/([A-Za-z0-9_-]+)/);
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

/** 根据链接抓取代码 */
export async function fetchCodeFromLink(
  link: ParsedLink,
  onStatus?: (msg: string) => void,
): Promise<FetchedCode> {
  const host = new URL(link.url).hostname.toLowerCase();
  if (host.includes('codepen.io')) {
    const penId = extractPenId(link.url);
    if (!penId) throw new Error('无法解析 CodePen 链接');
    onStatus?.('连接 CodePen…');
    const code = await fetchCodePen(penId);
    onStatus?.('获取 CodePen 代码');
    return code;
  }
  if (isGithubUrl(link.url)) {
    onStatus?.('连接 GitHub…');
    const code = await fetchGitHubCode(link.url, onStatus);
    onStatus?.('获取 GitHub 代码');
    return code;
  }
  if (isNetdiskUrl(link.url)) {
    onStatus?.('解析网盘直链…');
    const code = await fetchCodeFromNetdisk(link.url, link.password);
    onStatus?.('获取网盘文件内容');
    return { html: code.html, css: code.css, js: code.js, source: code.source };
  }
  throw new Error('该链接暂不支持自动抓取，请手动复制代码');
}
