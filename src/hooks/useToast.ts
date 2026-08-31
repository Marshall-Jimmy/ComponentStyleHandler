import { useCallback, useState } from 'react';
import type { ToastMessage } from '../types';
import { ANIMATION } from '../config';

/**
 * Toast 消息 Hook
 * 自动在 toastDuration 后消失。
 */

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** 先标记退场（触发对称退场动画），动画结束后再移除 */
  const dismissToast = useCallback(
    (id: string) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => removeToast(id), ANIMATION.toastExitDuration);
    },
    [removeToast],
  );

  const pushToast = useCallback(
    (type: ToastMessage['type'], text: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, type, text }]);
      setTimeout(() => dismissToast(id), ANIMATION.toastDuration);
    },
    [dismissToast],
  );

  return { toasts, pushToast, dismissToast };
}
