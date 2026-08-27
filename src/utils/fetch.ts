import { TIMEOUT } from '../config';

/**
 * 带超时的 fetch
 * 使用 AbortController 实现请求超时自动取消，超时后优雅降级。
 */

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = TIMEOUT.request,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 通过 CORS 代理请求（备选方案） */
export function proxiedUrl(url: string, proxy: string): string {
  return `${proxy}${encodeURIComponent(url)}`;
}

/** 判断错误是否为超时 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
