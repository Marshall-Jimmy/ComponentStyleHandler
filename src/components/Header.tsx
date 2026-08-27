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
        <div className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center border border-border bg-surface1 text-accent transition-transform duration-300 hover:scale-105">
            <span className="transition-transform duration-300 group-hover:rotate-[18deg]">
              <LayersIcon size={20} />
            </span>
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold tracking-wide text-primary">StyleHandler</p>
            <p className="text-[10px] tracking-[0.14em] text-tertiary">组件收藏与预览</p>
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
            className="w-full border border-border bg-surface1 py-2 pl-10 pr-4 text-sm text-primary placeholder:text-tertiary outline-none transition-all duration-300 focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(230,180,80,0.1)]"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="micro-icon-btn group grid h-9 w-9 place-items-center border border-border bg-surface1 text-secondary hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-focus"
            aria-label="打开设置"
            title="设置"
          >
            <span className="transition-transform duration-300 group-hover:rotate-90">
              <GearIcon size={18} />
            </span>
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="micro-btn group relative flex items-center gap-1.5 overflow-hidden bg-gradient-to-r from-accent to-accentHover px-3.5 py-2 text-sm font-semibold text-[#0B0B0C] focus-visible:outline-2 focus-visible:outline-focus"
            aria-label="添加组件"
          >
            <span aria-hidden="true" className="shine-sweep" />
            <PlusIcon size={17} className="transition-transform duration-300 group-hover:rotate-90" />
            <span className="micro-tracking hidden sm:inline">添加</span>
          </button>
        </div>
      </div>
    </header>
  );
}
