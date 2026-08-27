import { useCallback, useState } from 'react';

/**
 * 透明化进度：把解析过程按步骤实时展示给用户
 * "目前正在干啥干啥的" —— 每一步都可见
 */

export type ActivityState = 'done' | 'active' | 'error';

export interface ActivityItem {
  text: string;
  state: ActivityState;
}

/** 管理活动日志的 hook：advance 进入下一步、complete 标记完成、markError 标记失败 */
export function useActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  const advance = useCallback((text: string) => {
    setItems((prev) => {
      const marked = prev.map((it, i) =>
        i === prev.length - 1 && it.state === 'active' ? { ...it, state: 'done' as const } : it,
      );
      return [...marked, { text, state: 'active' as const }];
    });
  }, []);

  const complete = useCallback((text: string) => {
    setItems((prev) => {
      const marked = prev.map((it, i) =>
        i === prev.length - 1 && it.state === 'active' ? { ...it, state: 'done' as const } : it,
      );
      return [...marked, { text, state: 'done' as const }];
    });
  }, []);

  const markError = useCallback((text: string) => {
    setItems((prev) => {
      if (prev.length === 0) return [{ text, state: 'error' as const }];
      return prev.map((it, i) =>
        i === prev.length - 1 && it.state === 'active'
          ? { ...it, text, state: 'error' as const }
          : it,
      );
    });
  }, []);

  const reset = useCallback(() => setItems([]), []);

  return { items, advance, complete, markError, reset };
}
