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

  const { toasts, pushToast, removeToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, TIMEOUT.searchDebounce);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const handleDelete = useCallback(
    async (component: Component) => {
      if (!window.confirm(`确定删除「${component.name}」吗？`)) return;
      try {
        await deleteComponent(component.id);
        pushToast('success', '已删除');
      } catch {
        pushToast('error', '删除失败');
      }
    },
    [deleteComponent, pushToast],
  );

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

  const handleReset = useCallback(async () => {
    return reset();
  }, [reset]);

  return (
    <div className="min-h-screen bg-bg text-primary">
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
              onDelete={handleDelete}
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
      <Toast toasts={toasts} onDismiss={removeToast} />

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
