import { SearchIcon, PlusIcon, GearIcon, LayersIcon } from '../utils/icons';

interface HeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onOpenSettings: () => void;
}

/** 顶部导航栏：Logo、搜索框、操作按钮 */
export function Header({ search, onSearchChange, onAdd, onOpenSettings }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface1 text-accent">
            <LayersIcon size={20} />
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold text-primary">StyleHandler</p>
            <p className="text-[10px] text-tertiary">组件收藏与预览</p>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative mx-auto w-full max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tertiary">
            <SearchIcon size={16} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索组件名称或标签…"
            aria-label="搜索组件"
            className="w-full rounded-xl border border-border bg-surface1 py-2 pl-10 pr-4 text-sm text-primary placeholder:text-tertiary outline-none transition-colors focus:border-accent/60"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface1 text-secondary transition-all duration-200 hover:rotate-45 hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-focus"
            aria-label="打开设置"
            title="设置"
          >
            <GearIcon size={18} />
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accentHover px-3.5 py-2 text-sm font-semibold text-[#0B0B0C] transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
            aria-label="添加组件"
          >
            <PlusIcon size={17} />
            <span className="hidden sm:inline">添加</span>
          </button>
        </div>
      </div>
    </header>
  );
}
