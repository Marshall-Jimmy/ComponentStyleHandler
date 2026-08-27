import { AlertTriangleIcon, RefreshIcon, CloseIcon } from '../utils/icons';

interface ErrorBannerProps {
  message: string;
  onReload: () => void;
  onDismiss: () => void;
}

/** 全局错误横幅 */
export function ErrorBanner({ message, onReload, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="fixed left-1/2 top-4 z-[110] flex w-[min(92vw,520px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-danger/40 bg-surface2 px-4 py-3 text-sm text-primary shadow-elevation2 animate-slideInUp"
    >
      <span className="shrink-0 text-danger">
        <AlertTriangleIcon size={20} />
      </span>
      <span className="min-w-0 flex-1 truncate">{message}</span>
      <button
        type="button"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface3 px-2.5 py-1.5 text-xs text-primary transition-colors hover:border-borderStrong focus-visible:outline-2 focus-visible:outline-focus"
        onClick={onReload}
      >
        <RefreshIcon size={14} />
        重新加载
      </button>
      <button
        type="button"
        className="shrink-0 grid h-6 w-6 place-items-center rounded text-tertiary transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
        onClick={onDismiss}
        aria-label="关闭错误提示"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
