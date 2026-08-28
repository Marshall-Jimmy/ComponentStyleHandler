import { extOf } from './netdisk';

/** 代码托管平台统一返回结构 */
export interface HostCode {
  html: string;
  css: string;
  js: string;
  source: string;
}

/** 过程回调：透明展示每一步解析进度 */
export type HostStatus = (msg: string) => void;

export const README_CANDIDATES = [
  'README.md',
  'README.MD',
  'readme.md',
  'README.markdown',
  'README.rst',
  'readme.txt',
];

/** 按扩展名归类文本到对应编辑器 */
export function classifyText(text: string, name: string, source: string): HostCode {
  const ext = extOf(name);
  const isHtml = ['html', 'htm', 'xhtml', 'md', 'markdown', 'svg'].includes(ext);
  const isCss = ['css', 'scss', 'sass', 'less'].includes(ext);
  const isJs = ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'vue', 'svelte'].includes(ext);
  return {
    html: isHtml || (!isCss && !isJs) ? text : '',
    css: isCss ? text : '',
    js: isJs ? text : '',
    source,
  };
}

/** 从 Markdown 中提取代码块，按语言分类到 html/css/js */
export function extractCodeBlocks(md: string): { html: string; css: string; js: string } {
  const result: { html: string; css: string; js: string } = { html: '', css: '', js: '' };
  const regex = /```([\w+#-]*)\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(md)) !== null) {
    const lang = m[1].toLowerCase();
    const code = m[2].replace(/\n$/, '');
    if (!code) continue;
    if (['html', 'xml', 'htm', 'svg'].includes(lang)) {
      result.html += (result.html ? '\n\n' : '') + code;
    } else if (['css', 'scss', 'sass', 'less'].includes(lang)) {
      result.css += (result.css ? '\n\n' : '') + code;
    } else if (['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx', 'json', 'vue'].includes(lang)) {
      result.js += (result.js ? '\n\n' : '') + code;
    }
  }
  return result;
}

/** 拆分单文件 HTML：提取内联 style/script 到 css/js，剩余结构作为 html */
export function splitHtmlCode(source: string): { html: string; css: string; js: string } {
  const cssParts: string[] = [];
  const jsParts: string[] = [];
  // 先提取 script，避免后移除的 style 破坏 JS 内容中的 <style> 字面文本
  let cleaned = source.replace(
    /<script([^>]*)>([\s\S]*?)<\/script>/gi,
    (_match, attrs: string, inner: string) => {
      // 仅检查标签属性是否带 src，避免误判代码内容中的 "src="
      if (!/src=/i.test(attrs) && inner && inner.trim()) jsParts.push(inner.trim());
      return '';
    },
  );
  // 再提取 style
  cleaned = cleaned.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_match, inner: string) => {
    if (inner && inner.trim()) cssParts.push(inner.trim());
    return '';
  });
  return { html: cleaned.trim(), css: cssParts.join('\n\n'), js: jsParts.join('\n\n') };
}

/** 临时/废弃目录，合集导入时自动跳过 */
const TEMP_DIR_RE = /(^|\/)(临时|temp|tmp|backup|备份|old|test|测试)(\/|$)/i;

/** 仓库中的一个组件 Demo */
export interface RepoDemo {
  /** 组件名（目录名，根目录为 index） */
  name: string;
  /** 相对仓库根的 index.html 路径 */
  path: string;
  /** html 文件大小（字节） */
  size: number;
}

/** 仓库组件合集 */
export interface RepoCollection {
  demos: RepoDemo[];
  /** 默认分支 / ref */
  ref: string;
}

/**
 * 从仓库文件树收集组件 Demo：按 HTML 所在目录分组，每个目录取一个代表（优先 index.html）
 * 自动跳过 临时/temp 等废弃目录
 */
export function collectDemos(files: Array<{ path: string; type: string; size?: number }>): RepoDemo[] {
  const htmlFiles = files.filter(
    (f) => f.type === 'blob' && /\.html?$/i.test(f.path) && !TEMP_DIR_RE.test(f.path),
  );
  const groups = new Map<string, { path: string; size: number }>();
  for (const f of htmlFiles) {
    const segs = f.path.split('/').filter(Boolean);
    const parent = segs.length > 1 ? segs.slice(0, -1).join('/') : '';
    const isIndex = /index\.html?$/i.test(f.path);
    const cur = groups.get(parent);
    if (!cur || isIndex || (f.size ?? 0) < cur.size) {
      groups.set(parent, { path: f.path, size: f.size ?? 0 });
    }
  }
  return [...groups.entries()]
    .map(([parent, v]) => ({
      name: parent ? parent.split('/').pop()! : 'index',
      path: v.path,
      size: v.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

/**
 * 抓取 Demo 的 index.html 并把外部资源内联为自包含代码：
 * 外部 <link rel=stylesheet> → CSS，外部 <script src> → JS，<img> 与 CSS url() 的 svg → data URI
 * @param fetchText 按仓库内路径取原始文本（html/css/js/svg 等）
 */
export async function inlineDemoAssets(
  html: string,
  dirPath: string,
  fetchText: (repoPath: string) => Promise<string>,
): Promise<{ html: string; css: string; js: string }> {
  /** 把相对引用解析为仓库内路径（支持 ./ 与 ../） */
  const resolveIn = (baseDir: string, ref: string): string | null => {
    const t = ref.trim();
    if (!t || /^(https?:|data:|#|\/\/)/i.test(t)) return null;
    const clean = t.split(/[?#]/)[0];
    if (!clean) return null;
    const base = baseDir ? baseDir.split('/') : [];
    for (const p of clean.split('/')) {
      if (p === '' || p === '.') continue;
      if (p === '..') base.pop();
      else base.push(p);
    }
    return base.join('/') || null;
  };

  type TaskKind = 'css' | 'js' | 'asset';
  const tasks = new Map<string, TaskKind>();
  const collect = (baseDir: string, ref: string, kind: TaskKind) => {
    const p = resolveIn(baseDir, ref);
    if (p) tasks.set(p, kind);
  };

  // 扫描 HTML 里的外部引用
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const rel = tag.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href && rel && /\bstylesheet\b/i.test(rel)) collect(dirPath, href, 'css');
  }
  for (const tag of html.match(/<script\b[^>]*src\s*=\s*["'][^"']+["'][^>]*>/gi) ?? []) {
    const m = tag.match(/src\s*=\s*["']([^"']+)["']/i);
    if (m) collect(dirPath, m[1], 'js');
  }
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const m = tag.match(/src\s*=\s*["']([^"']+)["']/i);
    if (m) collect(dirPath, m[1], 'asset');
  }

  // 抓取所有任务内容（并行）
  const contents = new Map<string, string>();
  const failures = new Map<string, TaskKind>();
  await Promise.all(
    [...tasks.keys()].map(async (p) => {
      try {
        contents.set(p, await fetchText(p));
      } catch {
        failures.set(p, tasks.get(p)!);
      }
    }),
  );
  // 关键样式缺失会让组件以"无样式"形态被保存（效果全丢），必须显式报错而非静默跳过
  const missingCss = [...failures.entries()].find(([, kind]) => kind === 'css');
  if (missingCss) {
    throw new Error(`外部样式 ${missingCss[0]} 抓取失败，无法内联，已中止导入`);
  }

  // CSS 内的 url() 引用也要内联（svg 资源）
  const cssUrlExtra = new Map<string, string>();
  await Promise.all(
    [...tasks.entries()]
      .filter(([, kind]) => kind === 'css')
      .map(async ([p]) => {
        const css = contents.get(p);
        if (!css) return;
        const cssDir = p.split('/').slice(0, -1).join('/');
        for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
          const rp = resolveIn(cssDir, m[2]);
          if (!rp || tasks.has(rp) || cssUrlExtra.has(rp)) continue;
          try {
            cssUrlExtra.set(rp, await fetchText(rp));
          } catch {
            /* 忽略 */
          }
        }
      }),
  );

  const dataUri = (text: string): string =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;

  // 重组 HTML：移除已内联的外部 link/script，img 的 svg 转 data URI
  let htmlOut = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const rel = tag.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1];
    const rp = href && rel && /\bstylesheet\b/i.test(rel) ? resolveIn(dirPath, href) : null;
    return rp && contents.has(rp) ? '' : tag;
  });
  htmlOut = htmlOut.replace(/<script\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi, (full, src) => {
    const rp = resolveIn(dirPath, src);
    return rp && contents.has(rp) ? '' : full;
  });
  htmlOut = htmlOut.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
    const rp = src ? resolveIn(dirPath, src) : null;
    const txt = rp ? contents.get(rp) : undefined;
    if (rp && txt !== undefined && /\.svg$/i.test(rp)) {
      return tag.replace(/src\s*=\s*["'][^"']*["']/i, `src="${dataUri(txt)}"`);
    }
    return tag;
  });

  // 汇总 CSS / JS（外部 + 内联拆分）
  const cssParts: string[] = [];
  for (const [p, kind] of tasks.entries()) {
    if (kind !== 'css') continue;
    const css = contents.get(p);
    if (!css) continue;
    const cssDir = p.split('/').slice(0, -1).join('/');
    cssParts.push(
      css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (_full, _q, ref) => {
        const rp = resolveIn(cssDir, ref);
        const txt = rp ? (cssUrlExtra.get(rp) ?? contents.get(rp)) : undefined;
        if (rp && txt !== undefined && /\.svg$/i.test(rp)) return `url("${dataUri(txt)}")`;
        return _full;
      }).trim(),
    );
  }
  const jsParts: string[] = [];
  for (const [p, kind] of tasks.entries()) {
    if (kind !== 'js') continue;
    const js = contents.get(p);
    if (js) jsParts.push(js.trim());
  }

  const { html: coreHtml, css: inlineCss, js: inlineJs } = splitHtmlCode(htmlOut);
  return {
    html: coreHtml,
    css: [inlineCss, ...cssParts].filter(Boolean).join('\n\n'),
    js: [inlineJs, ...jsParts].filter(Boolean).join('\n\n'),
  };
}

/** base64 解码为 UTF-8 文本（Gitee contents API 内容为 base64） */
export function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\s+/g, ''));
  try {
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    try {
      return decodeURIComponent(escape(binary));
    } catch {
      return binary;
    }
  }
}

/** 从路径取文件名 */
export function basename(path: string): string {
  const seg = path.split('/').filter(Boolean).pop();
  return seg ?? path;
}

/** 从文件列表中选择 HTML 源码：优先 index.html，其次路径最浅的 html 文件 */
export function pickHtmlFile(
  files: Array<{ path: string; type: string }>,
  basePath = '',
): string | null {
  const scope = basePath ? files.filter((f) => f.path.startsWith(`${basePath}/`)) : files;
  const htmlFiles = scope.filter((f) => f.type === 'blob' && /\.html?$/i.test(f.path));
  if (htmlFiles.length === 0) return null;
  const pick =
    htmlFiles.find((f) => /index\.html?$/i.test(f.path)) ??
    htmlFiles.reduce((a, b) => (a.path.length <= b.path.length ? a : b));
  return pick.path;
}
