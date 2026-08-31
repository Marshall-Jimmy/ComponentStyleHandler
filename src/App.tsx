import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Component, ComponentDraft } from './types';
import { useComponents } from './hooks/useComponents';
import { useDebounce } from './hooks/useDebounce';
import { useToast } from './hooks/useToast';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { CardWall } from './components/CardWall';
import { ComponentModal } from './components/ComponentModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Toast } from './components/Toast';
import { ErrorBanner } from './components/ErrorBanner';
import { copyText } from './utils/clipboard';
import { emitHook } from './utils/events';
import { TIMEOUT } from './config';

/** 应用根组件 */
export default function App() {
  const {
    components,
    loading,
    dbError,
    saveComponent,
    deleteComponent,
    importComponents,
    reset,
    reload,
    dismissDbError,
  } = useComponents();

  const { toasts, pushToast, dismissToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, TIMEOUT.searchDebounce);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Component | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // 全局错误捕获
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      setFatalError(event.message || '发生未知错误');
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : '异步操作失败';
      setFatalError(reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  // 搜索触发插件钩子
  useEffect(() => {
    emitHook('stylehandler:search', { query: debouncedSearch });
  }, [debouncedSearch]);

  // 筛选：匹配名称与标签
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return components.filter((c) => {
      const matchTag = !activeTag || c.tags.includes(activeTag);
      if (!matchTag) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [components, debouncedSearch, activeTag]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((component: Component) => {
    setEditing(component);
    setModalOpen(true);
  }, []);

  const handleCopy = useCallback(
    async (component: Component) => {
      const code = [component.html, component.css, component.js].filter(Boolean).join('\n\n');
      const ok = await copyText(code);
      pushToast(ok ? 'success' : 'error', ok ? '已复制' : '复制失败');
    },
    [pushToast],
  );

  const handleDelete = useCallback(async (component: Component) => {
    try {
      await deleteComponent(component.id);
      pushToast('success', '已删除');
    } catch {
      pushToast('error', '删除失败');
    }
  }, [deleteComponent, pushToast]);

  const handleDeleteRequest = useCallback((component: Component) => {
    setDeleteTarget(component);
  }, []);

  const handleSave = useCallback(
    async (draft: ComponentDraft, existing?: Component) => {
      await saveComponent(draft, existing);
    },
    [saveComponent],
  );

  const handleImport = useCallback(
    async (items: Component[]) => {
      return importComponents(items);
    },
    [importComponents],
  );

  /** 合集批量导入：按 name+url 去重（url 归一化去尾斜杠）；已存在但 CSS 为空的破损残件则原位覆盖修复 */
  const handleBatchImport = useCallback(
    async (items: Component[]) => {
      const norm = (u?: string) => (u ?? '').replace(/\/+$/, '');
      const byKey = new Map(components.map((c) => [`${c.name}::${norm(c.url)}`, c]));
      const fresh: Component[] = [];
      const heal: Array<{ existing: Component; next: Component }> = [];
      for (const c of items) {
        const existing = byKey.get(`${c.name}::${norm(c.url)}`);
        if (!existing) {
          fresh.push(c);
        } else if (!(existing.css ?? '').trim()) {
          // CSS 为空说明当年导入时样式没存进去（效果全丢），删除残件并用新版本替换
          heal.push({ existing, next: c });
        }
      }
      if (fresh.length === 0 && heal.length === 0) return 0;
      for (const { existing } of heal) {
        await deleteComponent(existing.id);
      }
      const all = [...fresh, ...heal.map((h) => h.next)];
      const n = await importComponents(all);
      if (heal.length > 0) pushToast('success', `已修复 ${heal.length} 个无样式组件`);
      return n;
    },
    [components, importComponents, deleteComponent, pushToast],
  );

  const handleReset = useCallback(async () => {
    return reset();
  }, [reset]);

  return (
    <div className="relative min-h-screen text-primary">
      {/* 背景氛围：琥珀辉光 + 纵深感 */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-48 right-[-12%] h-[36rem] w-[36rem] bg-accent/[0.06] blur-[160px]" />
        <div className="absolute bottom-[-14rem] left-[-10%] h-[32rem] w-[32rem] bg-accent/[0.045] blur-[160px]" />
        <div className="absolute left-1/2 top-[32%] h-[26rem] w-[42rem] -translate-x-1/2 bg-[#6b3d00]/[0.05] blur-[150px]" />
      </div>
      <Header
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 sm:px-6">
        <Sidebar
          components={components}
          activeTag={activeTag}
          onSelectTag={setActiveTag}
          totalCount={components.length}
        />

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="grid place-items-center py-32 text-tertiary">
              <span className="animate-spin">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                </svg>
              </span>
            </div>
          ) : (
            <CardWall
              components={filtered}
              onCopy={handleCopy}
              onEdit={openEdit}
              onDelete={handleDeleteRequest}
              onClearFilters={() => {
                setSearch('');
                setActiveTag(null);
              }}
            />
          )}
        </div>
      </main>

      <ComponentModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onBatchImport={handleBatchImport}
        onToast={pushToast}
      />
      <SettingsModal
        open={settingsOpen}
        components={components}
        onClose={() => setSettingsOpen(false)}
        onImport={handleImport}
        onReset={handleReset}
        onToast={pushToast}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除组件"
        message={deleteTarget ? `确定删除「${deleteTarget.name}」吗？此操作不可恢复。` : ''}
        confirmText="删除"
        cancelText="取消"
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {fatalError && (
        <ErrorBanner
          message={fatalError}
          onReload={() => window.location.reload()}
          onDismiss={() => setFatalError(null)}
        />
      )}
      {dbError && (
        <ErrorBanner
          message={dbError}
          onReload={() => void reload()}
          onDismiss={dismissDbError}
        />
      )}
    </div>
  );
}
