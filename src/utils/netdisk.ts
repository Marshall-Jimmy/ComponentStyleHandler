import { NETDISK, CORS_PROXIES, NETDISK_HOSTS } from '../config';
import { fetchJson, fetchWithTimeout, proxiedUrl, isTimeoutError } from './fetch';

/**
 * 网盘直链解析
 * 浏览器端策略：
 * - 主要走 NFD 第三方聚合解析服务（CORS 已开启），覆盖蓝奏/123/夸克/奶牛/移动云/小飞机等
 * - 百度/阿里直链依赖登录态与动态签名，浏览器内无法匿名解析，返回明确提示
 */

export type NetdiskProvider =
  | 'baidu'
  | 'aliyun'
  | 'pan123'
  | 'lanzou'
  | 'quark'
  | 'cow'
  | 'weiyun'
  | 'xunlei'
  | 'ecloud'
  | 'mcloud'
  | 'feijipan'
  | 'uctransfer'
  | 'chengtong'
  | 'wenshushu'
  | 'fangcloud'
  | 'other';

export interface NetdiskFile {
  name: string;
  size?: number;
  isDir: boolean;
  fileId?: string;
  directUrl?: string;
}

export interface NetdiskResult {
  provider: NetdiskProvider;
  providerName: string;
  files: NetdiskFile[];
  shareId?: string;
  shareToken?: string;
  password?: string;
}

const PROVIDER_NAMES: Record<NetdiskProvider, string> = {
  baidu: '百度网盘',
  aliyun: '阿里云盘',
  pan123: '123云盘',
  lanzou: '蓝奏云',
  quark: '夸克网盘',
  cow: '奶牛快传',
  weiyun: '腾讯微云',
  xunlei: '迅雷云盘',
  ecloud: '天翼云盘',
  mcloud: '中国移动云盘',
  feijipan: '小飞机网盘',
  uctransfer: 'UC网盘',
  chengtong: '城通网盘',
  wenshushu: '文叔叔',
  fangcloud: '亿方云',
  other: '网盘',
};

/** 判断链接是否为网盘链接 */
export function isNetdiskUrl(url: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return NETDISK_HOSTS.some((h) => host.includes(h));
  } catch {
    return false;
  }
}

/** 识别网盘类型 */
export function detectNetdisk(url: string): NetdiskProvider | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.includes('pan.baidu.com')) return 'baidu';
  if (host.includes('aliyundrive.com') || host.includes('alipan.com')) return 'aliyun';
  if (host.includes('123pan') || host.includes('123684') || host.includes('123912')) return 'pan123';
  if (host.includes('lanzou') || host.includes('lanzn') || host.includes('ilanzou') || host.includes('lanzoui')) return 'lanzou';
  if (host.includes('quark.cn')) return 'quark';
  if (host.includes('cowtransfer.com')) return 'cow';
  if (host.includes('weiyun.com')) return 'weiyun';
  if (host.includes('pan.xunlei.com')) return 'xunlei';
  if (host.includes('cloud.189.cn')) return 'ecloud';
  if (host.includes('yun.139.com')) return 'mcloud';
  if (host.includes('feijipan.com') || host.includes('feijix.com')) return 'feijipan';
  if (host.includes('uc.cn')) return 'uctransfer';
  if (host.includes('ctfile.com') || host.includes('ctdisk.com')) return 'chengtong';
  if (host.includes('wenshushu.cn') || host.includes('wen.lu')) return 'wenshushu';
  if (host.includes('fangcloud.com')) return 'fangcloud';
  return null;
}

export function providerName(provider: NetdiskProvider | null): string {
  return provider ? PROVIDER_NAMES[provider] : '网盘';
}

/** 从分享链接提取分享 key（支持 /s/ /i/ /d/ /share/ 形式） */
export function extractShareKey(url: string): string | null {
  const match = url.match(/(?:\/s\/|\/i\/|\/d\/|\/share\/)([0-9A-Za-z_-]{4,64})/i);
  return match ? match[1] : null;
}

/** 文件大小格式化 */
export function formatSize(size?: number): string {
  if (size === undefined || size === null) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(2)} GB`;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  if (i < 0) return '';
  return name.slice(i + 1).toLowerCase();
}

const TEXT_EXTS = new Set([
  'html', 'htm', 'xhtml', 'css', 'scss', 'sass', 'less',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue', 'svelte', 'json',
  'txt', 'md', 'markdown', 'xml', 'svg', 'yml', 'yaml', 'log', 'csv', 'tsv',
  'php', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'sh', 'sql', 'toml', 'ini',
]);

/** 判断是否为可在编辑器预览的文本/代码文件 */
export function isTextFile(name: string): boolean {
  return TEXT_EXTS.has(extOf(name));
}

function guessFileName(url: string, fallback: string): string {
  try {
    const clean = new URL(url).pathname;
    const seg = clean.split('/').filter(Boolean).pop();
    if (seg) return decodeURIComponent(seg);
  } catch {
    /* ignore */
  }
  return fallback;
}

/** 通过 NFD 聚合解析服务获取直链 */
async function resolveViaQaiu(url: string, password?: string): Promise<NetdiskResult> {
  const provider = detectNetdisk(url) ?? 'other';
  const qs = new URLSearchParams({ url });
  if (password) qs.set('pwd', password);
  const data = (await fetchJson(`${NETDISK.qaiuParserApi}?${qs}`)) as {
    code?: number;
    success?: boolean;
    msg?: string;
    data?: { directLink?: string; directUrl?: string; shareKey?: string };
  };
  if (data.code !== 200 || !data.success || !data.data) {
    throw new Error(data.msg || '解析失败，该链接可能已失效或需要登录');
  }
  const directUrl = data.data.directLink ?? data.data.directUrl;
  if (!directUrl) throw new Error('未获取到直链');
  return {
    provider,
    providerName: PROVIDER_NAMES[provider],
    files: [{ name: guessFileName(directUrl, url), isDir: false, directUrl }],
  };
}

/** 阿里云盘匿名分享（best-effort，浏览器端常受 CORS 限制） */
async function parseAliyun(url: string, password?: string): Promise<NetdiskResult> {
  const shareId = extractShareKey(url);
  if (!shareId) throw new Error('未识别到阿里云盘分享 ID');
  const post = (endpoint: string, body: unknown) =>
    fetchJson(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const info = (await post(NETDISK.aliyunShareInfoApi, { share_id: shareId, share_pwd: password ?? '' })) as {
    code?: number;
    message?: string;
  };
  if (info.code !== 0) throw new Error(info.message || '阿里云盘分享信息获取失败');
  const token = (await post(NETDISK.aliyunShareTokenApi, { share_id: shareId, share_pwd: password ?? '' })) as {
    share_token?: string;
  };
  if (!token.share_token) throw new Error('获取阿里云盘分享令牌失败');
  const list = (await fetchJson(NETDISK.aliyunShareFileApi, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      share_id: shareId,
      share_token: token.share_token,
      parent_file_id: 'root',
      limit: 200,
      order_by: 'name',
      order_direction: 'ASC',
    }),
  })) as { items?: Array<{ file_id: string; name: string; size?: number; type?: string }> };
  return {
    provider: 'aliyun',
    providerName: PROVIDER_NAMES.aliyun,
    shareId,
    shareToken: token.share_token,
    password,
    files: (list.items ?? []).map((it) => ({
      name: it.name,
      size: it.size,
      isDir: it.type === 'folder',
      fileId: it.file_id,
    })),
  };
}

/**
 * 解析网盘分享链接，返回文件列表 / 直链。
 * 百度/阿里网盘无法在浏览器匿名解析，抛出带明确原因的异常。
 */
export async function parseNetdisk(url: string, password?: string): Promise<NetdiskResult> {
  const provider = detectNetdisk(url);
  if (!provider) throw new Error('未识别的网盘链接');
  if (provider === 'baidu') {
    throw new Error('百度网盘直链需要登录态与动态签名，浏览器内无法匿名解析，请直接打开分享页下载');
  }
  if (provider === 'aliyun') {
    try {
      return await parseAliyun(url, password);
    } catch {
      throw new Error('阿里云盘直链需要服务端代理或登录态，浏览器内无法匿名解析，可尝试打开分享页');
    }
  }
  if (provider === 'fangcloud') {
    // NFD 公共解析站暂未实现亿方云，明确提示避免误判为其他平台
    throw new Error('亿方云暂不支持浏览器内匿名解析，请直接打开分享页下载');
  }
  return resolveViaQaiu(url, password);
}

/** 解析单个文件的直链 */
export async function resolveDownload(ctx: NetdiskResult, file: NetdiskFile): Promise<string> {
  if (file.directUrl) return file.directUrl;
  if (ctx.provider === 'aliyun' && file.fileId && ctx.shareId && ctx.shareToken) {
    const data = (await fetchJson(NETDISK.aliyunDownloadApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        share_id: ctx.shareId,
        share_token: ctx.shareToken,
        file_id: file.fileId,
      }),
    })) as { download_url?: string };
    if (data.download_url) return data.download_url;
  }
  throw new Error('无法解析该文件的直链');
}

/** 抓取直链文本内容（带 CORS 代理链降级） */
export async function fetchTextUrl(url: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(url);
    if (res.ok) return await res.text();
  } catch (err) {
    if (!isTimeoutError(err)) {
      for (const proxy of CORS_PROXIES) {
        try {
          const proxied = await fetchWithTimeout(proxiedUrl(url, proxy));
          if (proxied.ok) return await proxied.text();
        } catch {
          /* 尝试下一个代理 */
        }
      }
    }
  }
  throw new Error('文件内容获取失败，可能受防盗链限制');
}

export interface NetdiskCode {
  html: string;
  css: string;
  js: string;
  source: string;
  directUrl?: string;
}

/** 按扩展名将文本拆分到对应编辑器 */
function splitCodeByExt(text: string, name: string, directUrl: string): NetdiskCode {
  const ext = extOf(name);
  const isHtml = ['html', 'htm', 'xhtml', 'svg'].includes(ext);
  const isCss = ['css', 'scss', 'sass', 'less'].includes(ext);
  const isJs = ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue', 'svelte', 'json'].includes(ext);
  // 未匹配到专属类型的通用文本默认放入 HTML
  const html = isHtml || (!isCss && !isJs) ? text : '';
  return { html, css: isCss ? text : '', js: isJs ? text : '', source: name, directUrl };
}

/** 从网盘链接抓取可编辑代码（供 B 站解析出的网盘链接使用） */
export async function fetchCodeFromNetdisk(url: string, password?: string): Promise<NetdiskCode> {
  const result = await parseNetdisk(url, password);
  const file =
    result.files.find((f) => !f.isDir && isTextFile(f.name)) ?? result.files.find((f) => !f.isDir);
  if (!file) throw new Error('网盘中未找到可下载的文件');
  const directUrl = await resolveDownload(result, file);
  if (!isTextFile(file.name)) {
    throw new Error(`网盘文件为二进制（${file.name}），无法填入编辑器，请复制直链下载`);
  }
  const text = await fetchTextUrl(directUrl);
  return splitCodeByExt(text, file.name, directUrl);
}
