import type { Component } from '../types';

/**
 * 插件钩子
 * 在保存、删除、搜索等关键操作后触发自定义事件，方便未来扩展统计或同步功能。
 * 使用 window.dispatchEvent 派发自定义事件，外部可通过 addEventListener 订阅。
 */

export const HOOK_EVENTS = {
  save: 'stylehandler:save',
  delete: 'stylehandler:delete',
  search: 'stylehandler:search',
  import: 'stylehandler:import',
  export: 'stylehandler:export',
} as const;

export type HookEventName = (typeof HOOK_EVENTS)[keyof typeof HOOK_EVENTS];

export interface HookPayload {
  component?: Component;
  query?: string;
  count?: number;
  timestamp: number;
}

/** 触发插件钩子事件 */
export function emitHook(name: HookEventName, payload: Omit<HookPayload, 'timestamp'> = {}): void {
  window.dispatchEvent(
    new CustomEvent<HookPayload>(name, {
      detail: { ...payload, timestamp: Date.now() },
    }),
  );
}
