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
