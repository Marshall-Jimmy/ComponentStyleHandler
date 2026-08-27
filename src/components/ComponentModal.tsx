import { useEffect, useRef, useState } from 'react';
import type { Component, ComponentDraft, ConvertTarget } from '../types';
import { CodeEditor } from './CodeEditor';
import { BilibiliParser } from './BilibiliParser';
import {
  CloseIcon,
  SparklesIcon,
  BroomIcon,
  ConvertIcon,
  TerminalIcon,
  ChevronDownIcon,
  SpinnerIcon,
} from '../utils/icons';
import { loadAIKeys, hasAIKey, cleanCode, convertCode, buildExportPrompt, parseCodeBlocks } from '../utils/ai';
import { copyText } from '../utils/clipboard';

interface ComponentModalProps {
  open: boolean;
  initial: Component | null;
  onClose: () => void;
  onSave: (draft: ComponentDraft, existing?: Component) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

const EMPTY: ComponentDraft = { name: '', url: '', tags: '', html: '', css: '', js: '' };

/** 聚焦时 SVG 边框动画的输入框 */
function SvgInput({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-secondary">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect
            x="0.5"
            y="0.5"
            width="100%"
            height="100%"
            rx="10"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />
          <rect
            x="0.5"
            y="0.5"
            width="100%"
            height="100%"
            rx="10"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
            strokeDasharray="1200"
            strokeDashoffset={focused ? 0 : 1200}
            style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          required={required}
          className="relative w-full rounded-[10px] bg-transparent px-3.5 py-2.5 text-sm text-primary placeholder:text-tertiary outline-none"
        />
      </div>
    </div>
  );
}

/** 添加/编辑组件模态框 */
export function ComponentModal({ open, initial, onClose, onSave, onToast }: ComponentModalProps) {
  const [draft, setDraft] = useState<ComponentDraft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [convertOpen, setConvertOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // 打开时初始化表单、锁定背景滚动、监听 ESC
  useEffect(() => {
    if (!open) return;
    setDraft(
      initial
        ? {
            name: initial.name,
            url: initial.url ?? '',
            tags: initial.tags.join(', '),
            html: initial.html,
            css: initial.css,
            js: initial.js,
          }
        : EMPTY,
    );
    setConvertOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, initial, onClose]);

  if (!open) return null;

  const set = (field: keyof ComponentDraft) => (value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!draft.name.trim()) {
      onToast('error', '组件名称不能为空');
      return;
    }
    setSaving(true);
    try {
      await onSave(draft, initial ?? undefined);
      onToast('success', '已保存');
      onClose();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /** AI 清理代码 */
  const handleClean = async () => {
    const keys = loadAIKeys();
    if (!hasAIKey(keys)) {
      onToast('error', '请先在设置中配置 API Key');
      return;
    }
    setAiBusy(true);
    setAiProgress(20);
    try {
      const result = await cleanCode(keys, draft.html, draft.css, draft.js);
      setAiProgress(80);
      const parsed = parseCodeBlocks(result);
      setDraft((prev) => ({
        ...prev,
        html: parsed.html || prev.html,
        css: parsed.css || prev.css,
        js: parsed.js || prev.js,
      }));
      setAiProgress(100);
      onToast('success', '代码已清理');
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'AI 请求失败');
    } finally {
      setAiBusy(false);
      setTimeout(() => setAiProgress(0), 400);
    }
  };

  /** AI 转换格式 */
  const handleConvert = async (target: ConvertTarget) => {
    setConvertOpen(false);
    const keys = loadAIKeys();
    if (!hasAIKey(keys)) {
      onToast('error', '请先在设置中配置 API Key');
      return;
    }
    setAiBusy(true);
    setAiProgress(20);
    try {
      const result = await convertCode(keys, target, draft.html, draft.css, draft.js);
      setAiProgress(80);
      setDraft((prev) => ({ ...prev, js: result.trim() }));
      setAiProgress(100);
      onToast('success', `已转换为 ${target}`);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'AI 请求失败');
    } finally {
      setAiBusy(false);
      setTimeout(() => setAiProgress(0), 400);
    }
  };

  /** 导出 Prompt */
  const handleExportPrompt = async () => {
    const prompt = buildExportPrompt(draft.html, draft.css, draft.js);
    const ok = await copyText(prompt);
    onToast(ok ? 'success' : 'error', ok ? 'Prompt 已复制到剪贴板' : '复制失败');
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={initial ? '编辑组件' : '添加组件'}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface2 shadow-elevation2 animate-scaleIn">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-primary">
            {initial ? '编辑组件' : '添加组件'}
          </h2>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-tertiary transition-colors hover:bg-surface3 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
            onClick={onClose}
            aria-label="关闭"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* 主体 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <SvgInput
            label="组件名称"
            value={draft.name}
            onChange={set('name')}
            placeholder="例如：琥珀渐变按钮"
            required
          />
          <SvgInput
            label="来源 URL"
            value={draft.url}
            onChange={set('url')}
            placeholder="粘贴 B 站视频链接可自动解析（支持 bilibili.com / b23.tv）"
          />
          <BilibiliParser
            url={draft.url}
            onCodeFetched={(html, css, js) =>
              setDraft((prev) => ({ ...prev, html, css, js }))
            }
            onError={(msg) => onToast('info', msg)}
          />
          <SvgInput
            label="标签"
            value={draft.tags}
            onChange={set('tags')}
            placeholder="逗号分隔，例如：按钮, 渐变, hover"
          />

          {/* AI 工具栏 */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg p-2">
            <span className="flex items-center gap-1.5 px-1 text-xs font-medium text-accent">
              <SparklesIcon size={14} />
              AI 助手
            </span>
            <button
              type="button"
              disabled={aiBusy}
              onClick={handleClean}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface1 px-2.5 py-1.5 text-xs text-secondary transition-colors hover:border-accent/50 hover:text-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus"
            >
              <BroomIcon size={14} />
              清理代码
            </button>
            <div className="relative">
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => setConvertOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface1 px-2.5 py-1.5 text-xs text-secondary transition-colors hover:border-accent/50 hover:text-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus"
                aria-haspopup="menu"
                aria-expanded={convertOpen}
              >
                <ConvertIcon size={14} />
                转换格式
                <ChevronDownIcon size={12} />
              </button>
              {convertOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-surface2 shadow-elevation2 animate-scaleIn"
                >
                  {(['React', 'Vue', 'Tailwind'] as ConvertTarget[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="menuitem"
                      onClick={() => handleConvert(t)}
                      className="block w-full px-3 py-2 text-left text-xs text-secondary transition-colors hover:bg-surface3 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={aiBusy}
              onClick={handleExportPrompt}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface1 px-2.5 py-1.5 text-xs text-secondary transition-colors hover:border-accent/50 hover:text-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus"
            >
              <TerminalIcon size={14} />
              导出 Prompt
            </button>

            {/* 环形进度 */}
            {aiBusy && (
              <div className="relative ml-auto grid h-7 w-7 place-items-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 28 28" aria-hidden="true">
                  <circle cx="14" cy="14" r="12" fill="none" stroke="var(--color-border)" strokeWidth="2.5" />
                  <circle
                    cx="14"
                    cy="14"
                    r="12"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="75.4"
                    strokeDashoffset={75.4 * (1 - aiProgress / 100)}
                    style={{ transition: 'stroke-dashoffset 0.3s' }}
                  />
                </svg>
                <span className="text-[9px] text-accent">{aiProgress}%</span>
              </div>
            )}
          </div>

          {/* 代码编辑器 */}
          <CodeEditor label="HTML" language="xml" value={draft.html} onChange={set('html')} />
          <CodeEditor label="CSS" language="css" value={draft.css} onChange={set('css')} />
          <CodeEditor label="JavaScript" language="javascript" value={draft.js} onChange={set('js')} />
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-secondary transition-colors hover:bg-surface3 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="relative flex items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-accent to-accentHover px-5 py-2 text-sm font-semibold text-[#0B0B0C] transition-transform duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-focus"
          >
            {saving ? (
              <>
                <span className="animate-spin">
                  <SpinnerIcon size={15} />
                </span>
                保存中…
              </>
            ) : (
              '保存'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
