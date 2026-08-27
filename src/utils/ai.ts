import { AI } from '../config';
import { fetchWithTimeout } from './fetch';
import type { AIKeys, ConvertTarget } from '../types';

/**
 * AI API 集成
 * 用户 API Key 仅存于 localStorage，请求直接 HTTPS 发送到对应端点，不经过任何第三方服务器。
 * 支持 OpenAI 与 Claude 两种后端。
 */

const STORAGE_KEY = AI.storageKey;

/** 读取 AI 配置 */
export function loadAIKeys(): AIKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { provider: 'openai', openaiKey: '', claudeKey: '', ...JSON.parse(raw) };
    }
  } catch {
    // 忽略损坏的存储
  }
  return { provider: 'openai', openaiKey: '', claudeKey: '' };
}

/** 保存 AI 配置 */
export function saveAIKeys(keys: AIKeys): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

/** 当前是否已配置所选 provider 的 key */
export function hasAIKey(keys: AIKeys): boolean {
  return keys.provider === 'openai' ? !!keys.openaiKey : !!keys.claudeKey;
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/** 调用 OpenAI Chat Completions */
async function callOpenAI(key: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetchWithTimeout(AI.openaiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: AI.openaiModel,
      messages,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, 'OpenAI'));
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

/** 调用 Claude Messages API */
async function callClaude(key: string, messages: ChatMessage[]): Promise<string> {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const user = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n');
  const res = await fetchWithTimeout(AI.claudeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI.claudeModel,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, 'Claude'));
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return data.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('') ?? '';
}

/** 解析 API 错误信息 */
async function apiErrorMessage(res: Response, provider: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    if (data.error?.message) return data.error.message;
  } catch {
    // 忽略解析失败
  }
  if (res.status === 401) return 'API Key 无效，请检查设置';
  if (res.status === 429) return 'API 请求频率超限，请稍后重试';
  return `${provider} 请求失败（${res.status}）`;
}

/** 通用 AI 对话入口 */
export async function chat(keys: AIKeys, system: string, user: string): Promise<string> {
  if (!hasAIKey(keys)) {
    throw new Error('请先在设置中配置 API Key');
  }
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  if (keys.provider === 'openai') {
    return callOpenAI(keys.openaiKey, messages);
  }
  return callClaude(keys.claudeKey, messages);
}

/** 将组件代码打包为字符串 */
export function buildComponentCode(html: string, css: string, js: string): string {
  return [
    '```html',
    html,
    '```',
    '',
    '```css',
    css,
    '```',
    '',
    '```js',
    js,
    '```',
  ].join('\n');
}

const CLEAN_SYSTEM =
  '你是一位资深前端工程师。请清理并格式化用户提供的组件代码，使其自包含、可独立运行。' +
  '要求：1) 保持原有功能与视觉；2) 移除冗余与错误代码；3) 返回格式为 HTML、CSS、JS 三段，' +
  '分别放在 ```html、```css、```js 代码块中；4) 不要输出任何解释文字。';

const CONVERT_SYSTEM =
  '你是一位资深前端工程师。请将用户提供的组件代码转换为指定框架/技术栈的完整组件代码。' +
  '要求：1) 输出可直接使用的组件文件代码；2) 使用 ``` 代码块包裹；3) 不要输出任何解释文字。';

/** 清理代码 */
export async function cleanCode(keys: AIKeys, html: string, css: string, js: string): Promise<string> {
  const code = buildComponentCode(html, css, js);
  return chat(keys, CLEAN_SYSTEM, `请清理以下组件代码：\n\n${code}`);
}

/** 转换格式 */
export async function convertCode(
  keys: AIKeys,
  target: ConvertTarget,
  html: string,
  css: string,
  js: string,
): Promise<string> {
  const code = buildComponentCode(html, css, js);
  return chat(
    keys,
    CONVERT_SYSTEM,
    `请将以下组件代码转换为 ${target} 组件：\n\n${code}`,
  );
}

/** 导出 Prompt：将组件代码打包为可复制的 prompt */
export function buildExportPrompt(html: string, css: string, js: string): string {
  return [
    '请根据以下组件代码，生成一个功能相同、视觉一致的组件。',
    '要求：保持原有交互与样式，输出自包含的 HTML/CSS/JS 代码。',
    '',
    buildComponentCode(html, css, js),
  ].join('\n');
}

/** 从 AI 返回文本中提取 html/css/js 代码块 */
export function parseCodeBlocks(text: string): { html: string; css: string; js: string } {
  const extract = (lang: string): string => {
    const re = new RegExp(`\`\`\`${lang}\\s*\\n([\\s\\S]*?)\\s*\`\`\``);
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  return { html: extract('html'), css: extract('css'), js: extract('js') };
}
