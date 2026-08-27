import { useEffect, useRef, useState } from 'react';
import { ActivityFeed } from './ActivityFeed';
import { useActivity } from '../hooks/useActivity';
import type { HostCode, HostStatus } from '../utils/codeUtils';
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
  /** 解析函数 */
  fetch: (url: string, onStatus?: HostStatus) => Promise<HostCode>;
  /** 解析中的提示文案 */
  hint: string;
  /** “打开原链接”按钮文案 */
  openLabel: string;
}

interface CodeHostParserProps {
  url: string;
  config: CodeHostConfig;
  onCodeFetched: (html: string, css: string, js: string, source: string) => void;
  onError: (message: string) => void;
}

type Stage = 'idle' | 'parsing' | 'done' | 'error';

/** 代码托管平台统一解析面板：GitHub / Gitee / GitLab 共用 */
export function CodeHostParser({ url, config, onCodeFetched, onError }: CodeHostParserProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const { items, advance, complete, markError, reset } = useActivity();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);

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

  // URL 变化后防抖自动解析
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDesc(config.describe(url));
    setStage('parsing');
    timerRef.current = setTimeout(() => {
      void run();
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
              onClick={() => void run()}
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
