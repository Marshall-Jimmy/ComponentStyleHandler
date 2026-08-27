import { useMemo } from 'react';
import type { Component } from '../types';

interface TagCloudProps {
  components: Component[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}

/** 标签配色（低饱和暖调，暗底友好） */
const TAG_COLORS = [
  { fill: 'rgba(230,180,80,0.14)', stroke: '#E6B450', text: '#F0C36A' },
  { fill: 'rgba(52,211,153,0.12)', stroke: '#34D399', text: '#6EE7B7' },
  { fill: 'rgba(34,211,238,0.12)', stroke: '#22D3EE', text: '#67E8F9' },
  { fill: 'rgba(248,113,113,0.12)', stroke: '#F87171', text: '#FCA5A5' },
  { fill: 'rgba(167,139,250,0.12)', stroke: '#A78BFA', text: '#C4B5FD' },
  { fill: 'rgba(251,191,36,0.12)', stroke: '#FBBF24', text: '#FCD34D' },
];

/** 单个 SVG 圆角矩形标签 */
function SvgTag({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: (typeof TAG_COLORS)[number];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="micro-tag relative inline-flex items-center focus-visible:outline-2 focus-visible:outline-focus"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <rect
          x="0.5"
          y="0.5"
          width="100%"
          height="100%"
          rx="0"
          fill={active ? color.fill : 'transparent'}
          stroke={active ? color.stroke : 'var(--color-border-strong)'}
          strokeWidth="1"
          style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
        />
      </svg>
      <span
        className="relative px-3 py-1 text-xs font-medium transition-colors duration-200"
        style={{ color: active ? color.text : 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
    </button>
  );
}

/** 标签云：统计所有标签，点击筛选 */
export function TagCloud({ components, activeTag, onSelect }: TagCloudProps) {
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    components.forEach((c) =>
      c.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)),
    );
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [components]);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="标签筛选">
      <SvgTag
        label="全部"
        active={activeTag === null}
        color={TAG_COLORS[0]}
        onClick={() => onSelect(null)}
      />
      {tags.map(([tag, count], i) => (
        <SvgTag
          key={tag}
          label={count > 1 ? `${tag} ${count}` : tag}
          active={activeTag === tag}
          color={TAG_COLORS[i % TAG_COLORS.length]}
          onClick={() => onSelect(activeTag === tag ? null : tag)}
        />
      ))}
    </div>
  );
}
