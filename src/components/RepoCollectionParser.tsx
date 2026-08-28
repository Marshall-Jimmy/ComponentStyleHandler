import { useMemo, useState } from 'react';
import type { Component } from '../types';
import { generateId } from '../db/database';
import { detectSourceTag } from '../utils/source';
import { sanitizeHtml, sanitizeCss } from '../utils/sanitize';
import type { HostCode, RepoDemo } from '../utils/codeUtils';
import type { CodeHostConfig } from './CodeHostParser';
import {
  CheckIcon,
  CloseIcon,
  ExternalLinkIcon,
  LayersIcon,
  RefreshIcon,
  SpinnerIcon,
} from '../utils/icons';

interface RepoCollectionParserProps {
  url: string;
  config: CodeHostConfig;
  demos: RepoDemo[];
  onCodeFetched: (html: string, css: string, js: string, source: string) => void;
  onBatchImport: (items: Component[]) => Promise<number>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
  onError: (message: string) => void;
}

/** 组件合集批量选择面板：勾选 → 预览 → 批量导入或单组件填入编辑器 */
export function RepoCollectionParser({
  url,
  config,
  demos,
  onCodeFetched,
  onBatchImport,
  onToast,
  onError,
}: RepoCollectionParserProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(demos.map((d) => d.path)));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<RepoDemo | null>(null);
  const [previewCode, setPreviewCode] = useState<HostCode | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // 合集面板仅在 listDemos + fetchDemo 就绪时渲染（CodeHostParser 保证），此处兜底
  const fetchDemo = config.fetchDemo;
  if (!fetchDemo) {
    return (
      <div className="rounded-lg border border-border bg-bg p-3 text-sm text-secondary">
        当前平台不支持组件合集导入
      </div>
    );
  }

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(demos.map((d) => d.path)));
  const selectNone = () => setSelected(new Set());

  const fmtSize = (size: number): string =>
    size >= 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;

  /** 预览单个 Demo：抓取并内联后渲染 srcdoc 快照 */
  const handlePreview = async (demo: RepoDemo) => {
    if (preview?.path === demo.path && previewCode) return;
    setPreview(demo);
    setPreviewCode(null);
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const code = await fetchDemo(url, demo);
      setPreviewCode(code);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  /** 组件名去重：同名的用父目录前缀区分 */
  const uniqueName = useMemo(() => {
    const seen = new Set<string>();
    return (d: RepoDemo): string => {
      let n = d.name;
      if (seen.has(n)) {
        const parent = d.path.split('/').slice(0, -1).join('/');
        n = parent ? parent.replace(/\//g, ' · ') : d.path;
      }
      seen.add(n);
      return n;
    };
  }, []);

  /** 把单个 Demo 填入编辑器（走单组件保存流程） */
  const handleEditOne = async (demo: RepoDemo) => {
    try {
      const code = await fetchDemo(url, demo);
      onCodeFetched(code.html, code.css, code.js, code.source);
      onToast('success', `「${demo.name}」已填入编辑器`);
    } catch (err) {
      onError(err instanceof Error ? err.message : '抓取失败');
    }
  };

  /** 批量导入所选 Demo */
  const handleBatchImport = async () => {
    const targets = demos.filter((d) => selected.has(d.path));
    if (targets.length === 0) {
      onToast('info', '请先勾选要导入的组件');
      return;
    }
    setBusy(true);
    setProgress(0);
    const now = Date.now();
    const built: Component[] = [];
    try {
      const sourceTag = detectSourceTag(url);
      for (let i = 0; i < targets.length; i++) {
        setProgress(i);
        const code = await fetchDemo(url, targets[i]);
        built.push({
          id: generateId(),
          name: uniqueName(targets[i]),
          url,
          tags: sourceTag ? [sourceTag] : [],
          html: sanitizeHtml(code.html),
          css: sanitizeCss(code.css),
          js: code.js,
          createdAt: now + i,
          updatedAt: now + i,
        });
      }
      const count = await onBatchImport(built);
      setProgress(targets.length);
      onToast('success', count > 0 ? `已导入 ${count} 个组件` : '所选组件已存在，无需重复导入');
    } catch (err) {
      onError(err instanceof Error ? err.message : '批量导入失败');
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = selected.size;

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-bg p-3 animate-fadeIn">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-accent">
            <LayersIcon size={16} />
          </span>
          <span className="font-medium text-primary">
            检测到 {demos.length} 个组件 Demo
          </span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="micro-btn flex items-center gap-1 text-xs text-tertiary hover:text-primary"
          >
            <ExternalLinkIcon size={12} />
            打开仓库
          </a>
        </div>
        <button
          type="button"
          onClick={() => onToast('info', '勾选需要导入的组件，或点击「导入到编辑器」单独填入')}
          className="micro-icon-btn grid h-6 w-6 place-items-center text-tertiary hover:bg-surface3 hover:text-primary"
          aria-label="帮助"
          title="勾选需要导入的组件，或点击「导入到编辑器」单独填入"
        >
          ?
        </button>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={selectAll}
            className="micro-btn border border-border bg-surface1 px-2 py-1 text-secondary hover:border-accent/50 hover:text-primary"
          >
            全选
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="micro-btn border border-border bg-surface1 px-2 py-1 text-secondary hover:border-accent/50 hover:text-primary"
          >
            全不选
          </button>
          <span className="ml-1 text-tertiary">已选 {selectedCount} 项</span>
        </div>
      </div>

      {/* 列表 */}
      <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {demos.map((d) => {
          const checked = selected.has(d.path);
          const isPreviewing = preview?.path === d.path;
          return (
            <li key={d.path} className="animate-fadeIn" style={{ animationDelay: `${demos.indexOf(d) * 20}ms` }}>
              <div className="flex items-center gap-2 px-2 py-1.5 transition-colors hover:bg-surface1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(d.path)}
                  className={`grid h-4 w-4 shrink-0 place-items-center border transition-colors ${
                    checked
                      ? 'border-accent bg-accent text-[#0B0B0C]'
                      : 'border-border bg-surface1 text-transparent hover:border-accent/50'
                  }`}
                >
                  <CheckIcon size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => void handlePreview(d)}
                  className="min-w-0 flex-1 text-left"
                  title="点击预览"
                >
                  <span className="block truncate text-sm text-primary">
                    {uniqueName(d)}
                    {checked && (
                      <span className="ml-2 rounded-sm bg-accent/10 px-1 text-[10px] text-accent">
                        已选
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-tertiary">
                    {d.path}
                    {d.size > 0 ? ` · ${fmtSize(d.size)}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleEditOne(d)}
                  className="micro-btn shrink-0 border border-border bg-surface1 px-2 py-1 text-[11px] text-secondary hover:border-accent/50 hover:text-primary"
                  title="单独填入编辑器，走保存流程"
                >
                  导入到编辑器
                </button>
              </div>

              {/* 预览区 */}
              {isPreviewing && (
                <div className="mx-2 mb-2 overflow-hidden rounded-md border border-border bg-white">
                  {previewLoading && (
                    <div className="grid h-40 place-items-center text-xs text-tertiary">
                      <span className="flex items-center gap-1.5">
                        <span className="animate-spin">
                          <SpinnerIcon size={14} />
                        </span>
                        正在生成预览…
                      </span>
                    </div>
                  )}
                  {previewError && (
                    <div className="flex h-40 items-center justify-center gap-2 px-3 text-xs text-danger">
                      <RefreshIcon size={13} />
                      {previewError}
                      <button
                        type="button"
                        onClick={() => void handlePreview(d)}
                        className="micro-btn border border-border px-1.5 py-0.5 text-secondary hover:text-primary"
                      >
                        重试
                      </button>
                    </div>
                  )}
                  {previewCode && (
                    <iframe
                      title={`预览 ${d.name}`}
                      sandbox="allow-scripts"
                      scrolling="no"
                      srcDoc={`<!doctype html><html><head><style>${previewCode.css}</style></head><body>${previewCode.html}<script>${previewCode.js}</script></body></html>`}
                      className="h-40 w-full"
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* 底部操作 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-tertiary">
          <span className="truncate">{config.describe(url)}</span>
          {busy && (
            <span className="flex shrink-0 items-center gap-1.5 text-secondary">
              <span className="animate-spin">
                <SpinnerIcon size={13} />
              </span>
              导入中 {progress}/{selectedCount}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={busy || selectedCount === 0}
          onClick={() => void handleBatchImport()}
          className="micro-btn relative flex shrink-0 items-center gap-1.5 overflow-hidden bg-gradient-to-r from-accent to-accentHover px-3.5 py-1.5 text-xs font-semibold text-[#0B0B0C] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <LayersIcon size={14} />
          批量导入（{selectedCount}）
        </button>
      </div>

      {/* 关闭提示 */}
      <div className="flex items-start gap-1.5 text-[11px] text-tertiary">
        <CloseIcon size={12} className="mt-0.5 shrink-0" />
        批量导入直接保存到组件库；「导入到编辑器」会填入下方代码区，编辑后再手动保存。
      </div>
    </div>
  );
}
