import { useEffect, useRef, useState } from 'react';
import {
  isBilibiliUrl,
  parseBilibili,
  fetchCodeFromLink,
  type BiliVideoInfo,
} from '../utils/bilibili';
import type { ParsedLink } from '../types';
import { SpinnerIcon, ExternalLinkIcon, LinkIcon, AlertTriangleIcon, CheckIcon } from '../utils/icons';

interface BilibiliParserProps {
  url: string;
  onCodeFetched: (html: string, css: string, js: string) => void;
  onError: (message: string) => void;
}

type Stage = 'idle' | 'parsing' | 'links' | 'fetching' | 'done' | 'error';

/** B 站链接解析面板：粘贴 B 站链接后自动解析并展示候选链接 */
export function BilibiliParser({ url, onCodeFetched, onError }: BilibiliParserProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [info, setInfo] = useState<BiliVideoInfo | null>(null);
  const [links, setLinks] = useState<ParsedLink[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 输入变化后防抖触发解析
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!url || !isBilibiliUrl(url)) {
      setStage('idle');
      setLinks([]);
      setInfo(null);
      return;
    }
    setStage('parsing');
    timerRef.current = setTimeout(async () => {
      try {
        const result = await parseBilibili(url);
        setInfo(result.info);
        setLinks(result.links);
        setStage(result.links.length > 0 ? 'links' : 'done');
        if (result.links.length === 0) {
          onError('未在简介或评论中发现代码/网盘链接');
        }
      } catch (err) {
        setStage('error');
        setError(err instanceof Error ? err.message : '解析失败');
      }
    }, 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  /** 用户选择链接后抓取代码 */
  const handleSelect = async (link: ParsedLink) => {
    setSelected(link.url);
    setStage('fetching');
    try {
      const code = await fetchCodeFromLink(link);
      onCodeFetched(code.html, code.css, code.js);
      setStage('done');
    } catch (err) {
      setStage('links');
      setSelected(null);
      onError(err instanceof Error ? err.message : '抓取失败');
    }
  };

  if (stage === 'idle') return null;

  const isFetching = stage === 'fetching';

  return (
    <div className="space-y-2 rounded-lg border border-border bg-bg p-3 animate-fadeIn">
      {stage === 'parsing' && (
        <div className="flex items-center gap-2 text-sm text-secondary">
          <span className="animate-spin text-accent">
            <SpinnerIcon size={18} />
          </span>
          正在解析 B 站链接…
        </div>
      )}

      {stage === 'links' && info && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-secondary">
            <LinkIcon size={14} className="text-accent" />
            <span className="truncate font-medium text-primary">{info.title}</span>
            <span className="shrink-0 text-tertiary">· {info.owner}</span>
          </p>
          <div className="space-y-1">
            {links.map((link) => (
              <button
                key={link.url}
                type="button"
                disabled={isFetching}
                onClick={() => handleSelect(link)}
                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus ${
                  selected === link.url
                    ? 'border-accent/60 bg-accent-soft'
                    : 'border-border bg-surface1 hover:border-accent/50'
                }`}
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    link.type === 'code'
                      ? 'bg-accent-soft text-accent'
                      : 'bg-[rgba(34,211,238,0.12)] text-info'
                  }`}
                >
                  {link.type === 'code' ? '代码' : '网盘'}
                </span>
                <span className="min-w-0 flex-1 truncate text-secondary">{link.url}</span>
                {link.password && (
                  <span className="shrink-0 font-mono text-tertiary">密码 {link.password}</span>
                )}
                <ExternalLinkIcon size={13} className="shrink-0 text-tertiary" />
              </button>
            ))}
          </div>
          <p className="text-[11px] text-tertiary">点击链接自动抓取代码填入编辑器</p>
        </div>
      )}

      {stage === 'fetching' && (
        <div className="flex items-center gap-2 text-sm text-secondary">
          <span className="animate-spin text-accent">
            <SpinnerIcon size={18} />
          </span>
          正在抓取代码…
        </div>
      )}

      {stage === 'done' && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckIcon size={16} />
          代码已填入编辑器
        </div>
      )}

      {stage === 'error' && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <AlertTriangleIcon size={16} />
          {error}
        </div>
      )}
    </div>
  );
}
