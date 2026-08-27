import { useEffect, useRef } from 'react';
import { AlertTriangleIcon } from '../utils/icons';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 自定义确认弹窗（替代原生 window.confirm） */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm border border-border bg-surface2 p-5 shadow-elevation2 animate-scaleIn">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-danger">
            <AlertTriangleIcon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-primary">{title}</h2>
            <p className="mt-1.5 text-sm text-secondary">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="micro-btn border border-border px-4 py-2 text-sm text-secondary hover:bg-surface3 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="micro-btn bg-danger px-4 py-2 text-sm font-semibold text-[#0B0B0C] focus-visible:outline-2 focus-visible:outline-focus"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
