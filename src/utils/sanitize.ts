import DOMPurify from 'dompurify';

/**
 * 输入清洗
 * 使用 DOMPurify 清洗用户输入的 HTML 与 CSS，防止存储型 XSS。
 * JS 代码仅作字符串存储，不执行、不清洗。
 */

/** 清洗 HTML 片段 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'style'],
  });
}

/** 清洗 CSS 文本（移除 url() 与表达式等危险片段） */
export function sanitizeCss(dirty: string): string {
  return dirty
    .replace(/url\s*\(\s*['"]?[^)'"]+['"]?\s*\)/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/@import/gi, '')
    .replace(/javascript\s*:/gi, '');
}
