import type { ActivityItem } from '../hooks/useActivity';
import { CheckIcon, SpinnerIcon, AlertTriangleIcon } from '../utils/icons';

/** 活动日志渲染：✓ 完成 / ● 进行中 / ! 失败 */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2 flex flex-col gap-1 border-b border-border pb-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="activity-item flex items-center gap-1.5 text-[11px] leading-4"
          style={{ animationDelay: `${i * 55}ms` }}
        >
          {item.state === 'done' && <CheckIcon size={12} className="shrink-0 text-success" />}
          {item.state === 'active' && (
            <span className="shrink-0 animate-spin text-accent">
              <SpinnerIcon size={12} />
            </span>
          )}
          {item.state === 'error' && (
            <AlertTriangleIcon size={12} className="shrink-0 text-danger" />
          )}
          <span
            className={
              item.state === 'active'
                ? 'font-medium text-primary'
                : item.state === 'error'
                  ? 'text-danger'
                  : 'text-secondary'
            }
          >
            {item.text}
          </span>
        </div>
      ))}
    </div>
  );
}
