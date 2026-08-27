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

  const pushToast = useCallback(
    (type: ToastMessage['type'], text: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, type, text }]);
      setTimeout(() => removeToast(id), ANIMATION.toastDuration);
    },
    [removeToast],
  );

  return { toasts, pushToast, removeToast };
}
