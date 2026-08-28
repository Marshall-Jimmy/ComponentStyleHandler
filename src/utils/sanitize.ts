import DOMPurify from 'dompurify';

/**
 * 输入清洗
 * 使用 DOMPurify 清洗用户输入的 HTML 与 CSS，防止存储型 XSS。
 * JS 代码仅作字符串存储，不执行、不清洗（最终只在 sandbox 隔离的 iframe 中运行）。
 * 注意：清洗只中和危险片段，必须保留组件的外观（内联 style、data:/http url() 背景图等），
 * 否则导入面板预览与卡片/全屏渲染会出现细节丢失的不一致。
 */

/** 清洗 HTML 片段（保留内联 style，DOMPurify 会安全化 style 值；事件属性默认被移除） */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  });
}

/** 清洗 CSS 文本：仅中和危险协议，保留 data:/http(s):/相对路径 url()（背景图、图标、字体） */
export function sanitizeCss(dirty: string): string {
  return dirty
    .replace(/@import/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/url\(\s*['"]?\s*(?:javascript|vbscript)\s*:[^)'"]*\)/gi, 'none')
    .replace(/javascript\s*:/gi, '');
}
