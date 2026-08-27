import type { Component } from '../types';
import { ComponentCard } from './ComponentCard';
import { EmptyState } from './EmptyState';
import { GRID } from '../config';

interface CardWallProps {
  components: Component[];
  onCopy: (component: Component) => void;
  onEdit: (component: Component) => void;
  onDelete: (component: Component) => void;
  onClearFilters: () => void;
}

/** 卡片墙：响应式网格布局 */
export function CardWall({
  components,
  onCopy,
  onEdit,
  onDelete,
  onClearFilters,
}: CardWallProps) {
  return (
    <div className="animate-fadeIn">
      {components.length === 0 ? (
        <EmptyState hasQuery={false} onClear={onClearFilters} />
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${GRID.minColumnWidth}px, 1fr))`,
          }}
        >
          {components.map((c, i) => (
            <div key={c.id} className="card-enter" style={{ ['--i' as string]: Math.min(i, 12) }}>
              <ComponentCard
                component={c}
                onCopy={onCopy}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
