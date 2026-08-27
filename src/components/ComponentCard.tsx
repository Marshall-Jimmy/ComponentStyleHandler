import type { Component } from '../types';
import { LivePreview } from './LivePreview';
import { CopyIcon, EditIcon, TrashIcon, ExternalLinkIcon } from '../utils/icons';

interface ComponentCardProps {
  component: Component;
  onCopy: (component: Component) => void;
  onEdit: (component: Component) => void;
  onDelete: (component: Component) => void;
}

/** 组件卡片 */
export function ComponentCard({ component, onCopy, onEdit, onDelete }: ComponentCardProps) {
  return (
    <article
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface1 p-4 shadow-elevation1 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-1 hover:border-borderStrong hover:shadow-elevation2"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 320px' }}
    >
      <LivePreview component={component} />

      {/* 元信息栏 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-primary" title={component.name}>
            {component.name}
          </h3>
          {component.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {component.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-surface3 px-2 py-0.5 text-[11px] text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {component.url && (
          <a
            href={component.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-tertiary transition-colors hover:bg-surface3 hover:text-accent focus-visible:outline-2 focus-visible:outline-focus"
            aria-label={`打开来源链接 ${component.name}`}
            title={component.url}
          >
            <ExternalLinkIcon size={16} />
          </a>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 border-t border-border pt-3">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-secondary transition-colors hover:bg-surface3 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => onCopy(component)}
          aria-label={`复制 ${component.name} 代码`}
        >
          <CopyIcon size={15} />
          复制
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-lg text-secondary transition-colors hover:bg-surface3 hover:text-accent focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => onEdit(component)}
          aria-label={`编辑 ${component.name}`}
        >
          <EditIcon size={16} />
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-lg text-secondary transition-colors hover:bg-surface3 hover:text-danger focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => onDelete(component)}
          aria-label={`删除 ${component.name}`}
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </article>
  );
}
