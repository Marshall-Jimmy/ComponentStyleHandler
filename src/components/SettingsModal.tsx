import { useEffect, useRef, useState } from 'react';
import type { AIKeys, Component } from '../types';
import { loadAIKeys, saveAIKeys } from '../utils/ai';
import { exportData, parseImportFile } from '../utils/exportImport';
import {
  CloseIcon,
  DownloadIcon,
  UploadIcon,
  RefreshIcon,
  CheckIcon,
} from '../utils/icons';

interface SettingsModalProps {
  open: boolean;
  components: Component[];
  onClose: () => void;
  onImport: (items: Component[]) => Promise<number>;
  onReset: () => Promise<boolean>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

/** 设置模态框：AI Key 配置 + 数据备份与恢复 */
export function SettingsModal({
  open,
  components,
  onClose,
  onImport,
  onReset,
  onToast,
}: SettingsModalProps) {
  const [keys, setKeys] = useState<AIKeys>(() => loadAIKeys());
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setKeys(loadAIKeys());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (patch: Partial<AIKeys>) => {
    const next = { ...keys, ...patch };
    setKeys(next);
    saveAIKeys(next);
  };

  const handleExport = () => {
    exportData(components);
    onToast('success', '数据已导出');
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const items = parseImportFile(text);
      const count = await onImport(items);
      onToast('success', count > 0 ? `已导入 ${count} 个组件` : '没有新增组件');
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : '导入失败');
    }
  };

  const handleReset = async () => {
    const ok = await onReset();
    onToast(ok ? 'success' : 'error', ok ? '数据库已重置' : '重置失败');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="设置"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface2 shadow-elevation2 animate-scaleIn">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-primary">设置</h2>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-tertiary transition-colors hover:bg-surface3 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* AI 配置 */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-primary">AI API 配置</h3>
            <p className="text-xs text-tertiary">
              API Key 仅保存在本地浏览器 localStorage 中，请求直接发送到对应服务商，不经过任何第三方服务器。
            </p>
            <div className="flex gap-2">
              {(['openai', 'claude'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => update({ provider: p })}
                  aria-pressed={keys.provider === p}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-focus ${
                    keys.provider === p
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-surface1 text-secondary hover:border-borderStrong'
                  }`}
                >
                  {p === 'openai' ? 'OpenAI' : 'Claude'}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-secondary">
                {keys.provider === 'openai' ? 'OpenAI API Key' : 'Claude API Key'}
              </label>
              <input
                type="password"
                value={keys.provider === 'openai' ? keys.openaiKey : keys.claudeKey}
                onChange={(e) =>
                  update(keys.provider === 'openai' ? { openaiKey: e.target.value } : { claudeKey: e.target.value })
                }
                placeholder="sk-..."
                className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-primary placeholder:text-tertiary outline-none transition-colors focus:border-accent/60"
              />
            </div>
          </section>

          {/* 数据管理 */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-primary">数据管理</h3>
            <p className="text-xs text-tertiary">
              所有组件数据存储在浏览器 IndexedDB 中，可导出 JSON 备份或导入合并。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface1 px-3 py-2 text-xs text-secondary transition-colors hover:border-accent/50 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
              >
                <DownloadIcon size={14} />
                导出数据
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface1 px-3 py-2 text-xs text-secondary transition-colors hover:border-accent/50 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
              >
                <UploadIcon size={14} />
                导入数据
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImportFile(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface1 px-3 py-2 text-xs text-secondary transition-colors hover:border-danger/50 hover:text-danger focus-visible:outline-2 focus-visible:outline-focus"
              >
                <RefreshIcon size={14} />
                重置数据库
              </button>
            </div>
          </section>

          {/* 关于 */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-primary">关于</h3>
            <p className="flex items-center gap-1.5 text-xs text-secondary">
              <CheckIcon size={13} className="text-success" />
              StyleHandler v1.0.0 · 离线可用 · 数据持久化
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
