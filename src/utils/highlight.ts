/**
 * 代码高亮
 * 使用 highlight.js，通过动态 import 异步加载，避免阻塞首次渲染。
 * 仅当首次需要高亮时才加载库与语言包。
 */

type HljsInstance = typeof import('highlight.js/lib/core').default;

let hljsPromise: Promise<HljsInstance> | null = null;

/** 懒加载 highlight.js 核心（不含语言包）与样式 */
function getHljs(): Promise<HljsInstance> {
  if (!hljsPromise) {
    hljsPromise = Promise.all([
      import('highlight.js/lib/core'),
      import('highlight.js/styles/github-dark.css'),
    ]).then(([mod]) => mod.default);
  }
  return hljsPromise;
}

const REGISTERED = new Set<string>();

/** 仅打包需要的语言包，避免全量语言库体积过大 */
const LANGUAGE_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  xml: () => import('highlight.js/lib/languages/xml'),
  css: () => import('highlight.js/lib/languages/css'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
};

/** 确保语言已注册（语言包按需加载） */
async function ensureLanguage(lang: string): Promise<void> {
  if (REGISTERED.has(lang)) return;
  const hljs = await getHljs();
  const loader = LANGUAGE_LOADERS[lang];
  if (loader) {
    try {
      const mod = await loader();
      hljs.registerLanguage(lang, mod.default as never);
      REGISTERED.add(lang);
      return;
    } catch {
      // 语言包加载失败时静默忽略，退回纯文本
    }
  }
  REGISTERED.add(lang);
}

const SUPPORTED = ['xml', 'css', 'javascript', 'typescript'];

/** 高亮代码，返回 HTML 字符串 */
export async function highlightCode(code: string, lang: string): Promise<string> {
  const safeLang = SUPPORTED.includes(lang) ? lang : 'plaintext';
  if (safeLang === 'plaintext' || !code.trim()) {
    return escapeHtml(code);
  }
  await ensureLanguage(safeLang);
  const hljs = await getHljs();
  try {
    return hljs.highlight(code, { language: safeLang }).value;
  } catch {
    return escapeHtml(code);
  }
}

/** HTML 转义 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
