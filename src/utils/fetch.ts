import { TIMEOUT, CORS_PROXIES } from '../config';

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

/**
 * 通用 JSON 请求
 * 先直连，失败（多为 CORS）后依次尝试多个公共 CORS 代理降级。
 */
export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  try {
    const res = await fetchWithTimeout(url, init);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    if (!isTimeoutError(err)) {
      for (const proxy of CORS_PROXIES) {
        try {
          const proxied = await fetchWithTimeout(proxiedUrl(url, proxy), init);
          if (proxied.ok) {
            return await proxied.json();
          }
        } catch {
          /* 尝试下一个代理 */
        }
      }
    }
  }
  throw new Error('请求失败，请检查网络或稍后重试');
}
