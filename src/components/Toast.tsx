import type { ReactNode } from 'react';
import type { ToastMessage } from '../types';
import { CheckIcon, AlertTriangleIcon, InfoIcon, CloseIcon } from '../utils/icons';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const STYLES: Record<ToastMessage['type'], { icon: ReactNode; ring: string }> = {
  success: { icon: <CheckIcon size={16} />, ring: 'text-success' },
  error: { icon: <AlertTriangleIcon size={16} />, ring: 'text-danger' },
  info: { icon: <InfoIcon size={16} />, ring: 'text-info' },
};

/** Toast 消息容器 */
export function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2"
      role="region"
      aria-label="通知"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`group pointer-events-auto flex items-center gap-2.5 border border-border bg-surface2 px-4 py-2.5 text-sm text-primary shadow-elevation2 transition-[border-color,box-shadow] duration-300 hover:border-accent/40 ${t.leaving ? 'animate-toastOut' : 'animate-toastIn'} ${STYLES[t.type].ring}`}
        >
          <span className="transition-transform duration-300 group-hover:scale-110">
            {STYLES[t.type].icon}
          </span>
          <span>{t.text}</span>
          <button
            type="button"
            className="micro-icon-btn ml-1 grid h-5 w-5 place-items-center text-tertiary hover:bg-surface3 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => onDismiss(t.id)}
            aria-label="关闭通知"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
