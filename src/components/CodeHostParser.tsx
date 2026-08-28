import { useEffect, useRef, useState } from 'react';
import { ActivityFeed } from './ActivityFeed';
import { useActivity } from '../hooks/useActivity';
import { RepoCollectionParser } from './RepoCollectionParser';
import type { Component } from '../types';
import type { HostCode, HostStatus, RepoCollection, RepoDemo } from '../utils/codeUtils';
import {
  SpinnerIcon,
  AlertTriangleIcon,
  CheckIcon,
  ExternalLinkIcon,
  RefreshIcon,
  LinkIcon,
} from '../utils/icons';

export interface CodeHostConfig {
  /** 展示名称：GitHub / Gitee / GitLab */
  label: string;
  /** 链接描述 */
  describe: (url: string) => string;
  /** 解析函数（单文件 / README） */
  fetch: (url: string, onStatus?: HostStatus) => Promise<HostCode>;
  /** 组件合集解析：列出仓库中的多个 Demo（文件/Blob 链接返回空数组） */
  listDemos?: (url: string, onStatus?: HostStatus) => Promise<RepoCollection>;
  /** 抓取单个 Demo（HTML 内联外部资源） */
  fetchDemo?: (url: string, demo: RepoDemo, onStatus?: HostStatus) => Promise<HostCode>;
  /** 解析中的提示文案 */
  hint: string;
  /** “打开原链接”按钮文案 */
  openLabel: string;
}

interface CodeHostParserProps {
  url: string;
  config: CodeHostConfig;
  onCodeFetched: (html: string, css: string, js: string, source: string) => void;
  onBatchImport: (items: Component[]) => Promise<number>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
  onError: (message: string) => void;
}

type Stage = 'idle' | 'parsing' | 'collection' | 'done' | 'error';

/** 代码托管平台统一解析面板：GitHub / Gitee / GitLab 共用 */
export function CodeHostParser({
  url,
  config,
  onCodeFetched,
  onBatchImport,
  onToast,
  onError,
}: CodeHostParserProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const [demos, setDemos] = useState<RepoDemo[]>([]);
  const { items, advance, complete, markError, reset } = useActivity();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);

  /** 单组件 / README 解析（回退路径） */
  const run = async () => {
    setStage('parsing');
    setError('');
    reset();
    cancelRef.current = false;
    try {
      const code = await config.fetch(url, (msg) => {
        if (!cancelRef.current) advance(msg);
      });
      if (cancelRef.current) return;
      complete('内容已获取');
      onCodeFetched(code.html, code.css, code.js, code.source);
      setStage('done');
    } catch (err) {
      if (cancelRef.current) return;
      const msg = err instanceof Error ? err.message : `${config.label} 解析失败`;
      markError(msg);
      setError(msg);
      setStage('error');
      onError(msg);
    }
  };

  /** 合集解析：先列 Demo，≥2 个进入批量选择面板，1 个自动导入，0 个回退单文件解析 */
  const runCollection = async () => {
    if (!config.listDemos || !config.fetchDemo) {
      void run();
      return;
    }
    setStage('parsing');
    setError('');
    reset();
    cancelRef.current = false;
    try {
      let collection: RepoCollection;
      try {
        collection = await config.listDemos(url, (msg) => {
          if (!cancelRef.current) advance(msg);
        });
      } catch {
        // 列表失败（网络/接口）回退单文件解析，错误由 run 统一提示
        if (cancelRef.current) return;
        await run();
        return;
      }
      if (cancelRef.current) return;

      if (collection.demos.length >= 2) {
        setDemos(collection.demos);
        setStage('collection');
        return;
      }
      if (collection.demos.length === 1) {
        const code = await config.fetchDemo(url, collection.demos[0], (msg) => {
          if (!cancelRef.current) advance(msg);
        });
        if (cancelRef.current) return;
        complete('组件已填入编辑器');
        onCodeFetched(code.html, code.css, code.js, code.source);
        setStage('done');
        return;
      }
      // 无 HTML Demo → 回退 README / 单文件解析
      await run();
    } catch (err) {
      if (cancelRef.current) return;
      const msg = err instanceof Error ? err.message : `${config.label} 解析失败`;
      markError(msg);
      setError(msg);
      setStage('error');
      onError(msg);
    }
  };

  // URL 变化后防抖自动解析
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDesc(config.describe(url));
    setStage('parsing');
    timerRef.current = setTimeout(() => {
      void runCollection();
    }, 500);
    return () => {
      cancelRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, config]);

  if (stage === 'idle') return null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-bg p-3 animate-fadeIn">
      <ActivityFeed items={items} />

      {stage === 'parsing' && (
        <div className="flex items-center gap-2 text-sm text-secondary">
          <span className="animate-spin text-accent">
            <SpinnerIcon size={18} />
          </span>
          正在解析 {config.label} 链接…{config.hint}
        </div>
      )}

      {stage === 'collection' && (
        <RepoCollectionParser
          url={url}
          config={config}
          demos={demos}
          onCodeFetched={onCodeFetched}
          onBatchImport={onBatchImport}
          onToast={onToast}
          onError={onError}
        />
      )}

      {stage === 'done' && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckIcon size={16} />
          <span className="truncate">{desc}</span> 已填入编辑器
        </div>
      )}

      {stage === 'error' && (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 text-sm text-danger">
            <AlertTriangleIcon size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => void runCollection()}
              className="micro-btn flex items-center gap-1.5 border border-border bg-surface1 px-2.5 py-1.5 text-secondary hover:border-accent/50 hover:text-primary"
            >
              <RefreshIcon size={13} />
              重试
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="micro-btn flex items-center gap-1.5 border border-border bg-surface1 px-2.5 py-1.5 text-secondary hover:border-accent/50 hover:text-primary"
            >
              <ExternalLinkIcon size={13} />
              {config.openLabel}
            </a>
            <span className="flex items-center gap-1 text-tertiary">
              <LinkIcon size={12} />
              {desc}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
