import { TagIcon } from '../utils/icons';
import { TagCloud } from './TagCloud';
import type { Component } from '../types';

interface SidebarProps {
  components: Component[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  totalCount: number;
}

/** 侧边栏：标签云 + 统计 */
export function Sidebar({ components, activeTag, onSelectTag, totalCount }: SidebarProps) {
  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="sticky top-20 space-y-4 rounded-2xl border border-border bg-surface1 p-4">
        <div className="flex items-center gap-2">
          <span className="text-accent">
            <TagIcon size={16} />
          </span>
          <h2 className="text-sm font-medium text-primary">标签筛选</h2>
        </div>
        <TagCloud components={components} activeTag={activeTag} onSelect={onSelectTag} />
        <p className="border-t border-border pt-3 text-xs text-tertiary">
          共 {totalCount} 个组件
        </p>
      </div>
    </aside>
  );
}
