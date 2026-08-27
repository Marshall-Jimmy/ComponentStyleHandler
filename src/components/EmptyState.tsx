import { BoxIcon } from '../utils/icons';

interface EmptyStateProps {
  hasQuery: boolean;
  onClear: () => void;
}

/** 空状态：SVG 空盒子插画 + 提示文字 */
export function EmptyState({ hasQuery, onClear }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center animate-fadeIn">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-accent-soft blur-2xl" aria-hidden="true" />
        <div className="relative grid h-28 w-28 place-items-center rounded-2xl border border-border bg-surface2 text-tertiary shadow-elevation2">
          <BoxIcon size={56} />
          <span className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-surface3 text-secondary">
            <BoxIcon size={16} />
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-medium text-primary">
          {hasQuery ? '没有找到匹配的组件' : '还没有收藏任何组件'}
        </p>
        <p className="text-sm text-secondary">
          {hasQuery ? '试试更换关键词或清除筛选条件' : '点击右上角 + 添加你的第一个组件'}
        </p>
      </div>
      {hasQuery && (
        <button
          type="button"
          className="rounded-lg border border-border bg-surface3 px-4 py-2 text-sm text-primary transition-colors hover:border-borderStrong focus-visible:outline-2 focus-visible:outline-focus"
          onClick={onClear}
        >
          清除筛选
        </button>
      )}
    </div>
  );
}
