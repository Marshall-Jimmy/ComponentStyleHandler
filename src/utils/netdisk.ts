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
  | 'ysepan'
  | 'other';

export interface NetdiskFile {
  name: string;
  size?: number;
  isDir: boolean;
  fileId?: string;
  directUrl?: string;
  /** 文件夹导航 URL（NFD 目录项的 parserUrl，进入子目录用） */
  folderUrl?: string;
}

export interface NetdiskResult {
  provider: NetdiskProvider;
  providerName: string;
  files: NetdiskFile[];
  shareId?: string;
  shareToken?: string;
  password?: string;
  /** 当前目录编号（永硕E盘 dirId，目录导航用） */
  dirId?: string;
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
  ysepan: '永硕E盘',
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
  if (host.includes('ysepan.com')) return 'ysepan';
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

/** NFD 响应信封 */
interface QaiuEnvelope {
  code?: number;
  msg?: string;
  success?: boolean;
  data?: unknown;
}

/** NFD 目录/文件列表项 */
interface QaiuFileItem {
  fileName?: string;
  fileId?: string;
  size?: number;
  fileType?: string;
  parserUrl?: string;
}

/**
 * 请求 NFD 单个端点：忽略 HTTP 状态码解析 JSON 体（NFD 用 body 内 code 表语义，可能返回 HTTP 500 + JSON 错误体），
 * 直连失败（网络/CDN 拦截返回 HTML）后走 CORS 代理链降级。
 */
async function qaiuFetch(base: string, qs: URLSearchParams): Promise<QaiuEnvelope | null> {
  const url = `${base}?${qs}`;
  const attempt = async (u: string): Promise<QaiuEnvelope | null> => {
    try {
      const res = await fetchWithTimeout(u);
      const text = await res.text();
      try {
        return JSON.parse(text) as QaiuEnvelope;
      } catch {
        return null; // 非 JSON（CDN 拦截页等）
      }
    } catch {
      return null;
    }
  };
  const direct = await attempt(url);
  if (direct) return direct;
  for (const proxy of CORS_PROXIES) {
    const via = await attempt(proxiedUrl(url, proxy));
    if (via) return via;
  }
  return null;
}

/** 请求 NFD 服务：按序尝试多个公共站，成功（code=200）即返回 data */
async function qaiuRequest<T>(bases: string[], qs: URLSearchParams): Promise<T> {
  let lastError: Error | null = null;
  for (const base of bases) {
    const env = await qaiuFetch(base, qs);
    if (env) {
      if (env.code === 200 && env.success) return env.data as T;
      lastError = new Error(env.msg || '解析失败，该链接可能已失效或需要登录');
    } else {
      lastError = new Error('解析服务暂时不可用，请稍后重试');
    }
  }
  throw lastError ?? new Error('解析服务不可用');
}

/** 通过 NFD 聚合解析服务获取单文件直链 */
async function resolveViaQaiu(url: string, password?: string): Promise<NetdiskResult> {
  const provider = detectNetdisk(url) ?? 'other';
  const qs = new URLSearchParams({ url });
  if (password) qs.set('pwd', password);
  const data = await qaiuRequest<{ directLink?: string; directUrl?: string }>(
    [NETDISK.qaiuParserApi, NETDISK.qaiuParserApiAlt],
    qs,
  );
  const directUrl = data.directLink ?? data.directUrl;
  if (!directUrl) throw new Error('未获取到直链');
  return {
    provider,
    providerName: PROVIDER_NAMES[provider],
    files: [{ name: guessFileName(directUrl, url), isDir: false, directUrl }],
  };
}

/** 通过 NFD 文件夹列表接口解析目录（支持蓝奏/蓝奏优享/小飞机/永硕E盘等） */
async function fetchQaiuFolder(url: string, password?: string, dirId?: string): Promise<NetdiskResult> {
  const provider = detectNetdisk(url) ?? 'other';
  const qs = new URLSearchParams({ url });
  if (password) qs.set('pwd', password);
  if (dirId) qs.set('dirId', dirId);
  const data = await qaiuRequest<QaiuFileItem[] | null>(
    [NETDISK.qaiuFileListApi, NETDISK.qaiuFileListApiAlt],
    qs,
  );
  return {
    provider,
    providerName: PROVIDER_NAMES[provider],
    password,
    dirId,
    files: (Array.isArray(data) ? data : []).map((it) => {
      const isDir = it.fileType === 'folder';
      return {
        name: it.fileName ?? '未知文件',
        size: it.size,
        isDir,
        fileId: it.fileId,
        directUrl: isDir ? undefined : it.parserUrl,
        folderUrl: isDir ? it.parserUrl : undefined,
      };
    }),
  };
}

/** 进入网盘子目录（UI 文件夹导航用；永硕E盘需带 dirId 目录编号） */
export async function listNetdiskFolder(
  folder: NetdiskFile,
  baseUrl: string,
  password?: string,
): Promise<NetdiskResult> {
  const target = folder.folderUrl ?? baseUrl;
  const provider = detectNetdisk(target) ?? detectNetdisk(baseUrl) ?? 'other';
  return fetchQaiuFolder(target, password, provider === 'ysepan' ? folder.fileId : undefined);
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
 * 策略：
 * - NFD 平台先尝试文件夹列表接口（支持目录分享展示多文件），失败回退单文件直链
 * - 百度/阿里网盘无法在浏览器匿名解析，抛出带明确原因的异常
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
  // 其余平台走 NFD：优先文件夹列表，单文件或平台不支持目录时回退直链
  try {
    const folder = await fetchQaiuFolder(url, password);
    if (folder.files.length > 0) return folder;
  } catch {
    /* 单文件/平台不支持文件夹，走直链 */
  }
  try {
    return await resolveViaQaiu(url, password);
  } catch (err) {
    if (provider === 'fangcloud') {
      throw new Error('亿方云暂不支持浏览器内匿名解析，请直接打开分享页下载');
    }
    throw err;
  }
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

/** 从网盘链接抓取可编辑代码（供 B 站解析出的网盘链接使用；目录分享自动下钻找文本文件） */
export async function fetchCodeFromNetdisk(url: string, password?: string): Promise<NetdiskCode> {
  const result = await parseNetdisk(url, password);
  return pickCodeFromResult(result, url, password, 0);
}

/** 在网盘结果中挑选文本文件：优先文件，无文件时进入第一个子目录继续找（限制深度防止无限递归） */
async function pickCodeFromResult(
  result: NetdiskResult,
  baseUrl: string,
  password: string | undefined,
  depth: number,
): Promise<NetdiskCode> {
  if (depth > 3) throw new Error('网盘目录层级过深，请手动选择文件');
  const file =
    result.files.find((f) => !f.isDir && isTextFile(f.name)) ?? result.files.find((f) => !f.isDir);
  if (file) {
    const directUrl = file.directUrl ?? (await resolveDownload(result, file));
    if (!isTextFile(file.name)) {
      throw new Error(`网盘文件为二进制（${file.name}），无法填入编辑器，请复制直链下载`);
    }
    const text = await fetchTextUrl(directUrl);
    return splitCodeByExt(text, file.name, directUrl);
  }
  const folder = result.files.find((f) => f.isDir);
  if (!folder || !folder.folderUrl) throw new Error('网盘中未找到可下载的文件');
  const next = await listNetdiskFolder(folder, baseUrl, password);
  return pickCodeFromResult(next, baseUrl, password, depth + 1);
}
