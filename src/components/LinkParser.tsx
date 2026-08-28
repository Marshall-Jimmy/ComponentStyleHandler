import { useEffect, useMemo, useRef, useState } from 'react';
import { isBilibiliUrl, fetchCodeFromLink } from '../utils/bilibili';
import { isNetdiskUrl } from '../utils/netdisk';
import {
  isGithubUrl,
  describeGithubUrl,
  fetchGitHubCode,
  listGithubDemos,
  fetchGithubDemo,
} from '../utils/github';
import {
  isGiteeUrl,
  describeGiteeUrl,
  fetchGiteeCode,
  listGiteeDemos,
  fetchGiteeDemo,
} from '../utils/gitee';
import {
  isGitlabUrl,
  describeGitlabUrl,
  fetchGitlabCode,
  listGitlabDemos,
  fetchGitlabDemo,
} from '../utils/gitlab';
import type { ParsedLink, Component } from '../types';
import { BilibiliParser } from './BilibiliParser';
import { NetdiskParser } from './NetdiskParser';
import { CodeHostParser, type CodeHostConfig } from './CodeHostParser';
import { ActivityFeed } from './ActivityFeed';
import { useActivity } from '../hooks/useActivity';
import { TagIcon, SpinnerIcon, AlertTriangleIcon, CheckIcon, ExternalLinkIcon } from '../utils/icons';

interface LinkParserProps {
  url: string;
  onCodeFetched: (html: string, css: string, js: string) => void;
  onBatchImport: (items: Component[]) => Promise<number>;
  onToast: (type: 'success' | 'error' | 'info', text: string) => void;
  onError: (message: string) => void;
}

type LinkKind = 'github' | 'gitee' | 'gitlab' | 'bilibili' | 'netdisk' | 'code' | null;

const KIND_LABEL: Record<Exclude<LinkKind, null>, string> = {
  github: 'GitHub',
  gitee: 'Gitee',
  gitlab: 'GitLab',
  bilibili: 'B 站',
  netdisk: '网盘',
  code: '代码托管',
};

/** 三个代码托管平台各自的解析配置 */
const HOST_CONFIGS: Record<'github' | 'gitee' | 'gitlab', CodeHostConfig> = {
  github: {
    label: 'GitHub',
    describe: describeGithubUrl,
    fetch: fetchGitHubCode,
    listDemos: listGithubDemos,
    fetchDemo: fetchGithubDemo,
    hint: '（直连失败将自动切换 gh-proxy.com 镜像）',
    openLabel: '在 GitHub 打开',
  },
  gitee: {
    label: 'Gitee',
    describe: describeGiteeUrl,
    fetch: fetchGiteeCode,
    listDemos: listGiteeDemos,
    fetchDemo: fetchGiteeDemo,
    hint: '',
    openLabel: '在 Gitee 打开',
  },
  gitlab: {
    label: 'GitLab',
    describe: describeGitlabUrl,
    fetch: fetchGitlabCode,
    listDemos: listGitlabDemos,
    fetchDemo: fetchGitlabDemo,
    hint: '',
    openLabel: '在 GitLab 打开',
  },
};

/** 判断是否为其他代码托管站（CodePen / jsFiddle） */
function isCodeHostUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === 'codepen.io' || host.endsWith('.codepen.io') || host === 'jsfiddle.net' || host.endsWith('.jsfiddle.net');
}

/** 识别链接类型：B 站 / 网盘 / GitHub / Gitee / GitLab / CodePen 等代码托管站 */
function detectKind(url: string): LinkKind {
  if (!url) return null;
  if (isBilibiliUrl(url)) return 'bilibili';
  if (isNetdiskUrl(url)) return 'netdisk';
  if (isGithubUrl(url)) return 'github';
  if (isGiteeUrl(url)) return 'gitee';
  if (isGitlabUrl(url)) return 'gitlab';
  if (isCodeHostUrl(url)) return 'code';
  return null;
}

/** 其他代码托管站（CodePen 等）：直接抓取代码 */
function OtherCodeParser({
  url,
  onCodeFetched,
  onError,
}: {
  url: string;
  onCodeFetched: (html: string, css: string, js: string) => void;
  onError: (message: string) => void;
}) {
  const [stage, setStage] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const { items, advance, complete, markError, reset } = useActivity();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);

  const run = async () => {
    setStage('parsing');
    setError('');
    reset();
    cancelRef.current = false;
    const link: ParsedLink = { url, label: new URL(url).hostname, type: 'code' };
    try {
      const code = await fetchCodeFromLink(link, (msg) => {
        if (!cancelRef.current) advance(msg);
      });
      if (cancelRef.current) return;
      complete('代码已填入编辑器');
      onCodeFetched(code.html, code.css, code.js);
      setStage('done');
    } catch (err) {
      if (cancelRef.current) return;
      const msg = err instanceof Error ? err.message : '抓取失败';
      markError(msg);
      setError(msg);
      setStage('error');
      onError(msg);
    }
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    reset();
    setStage('parsing');
    timerRef.current = setTimeout(() => {
      void run();
    }, 500);
    return () => {
      cancelRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (stage === 'idle') return null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-bg p-3 animate-fadeIn">
      <ActivityFeed items={items} />
      {stage === 'parsing' && (
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
        <div className="flex items-start justify-between gap-2 text-sm text-danger">
          <p className="flex items-start gap-1.5">
            <AlertTriangleIcon size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="micro-btn flex shrink-0 items-center gap-1 text-xs text-secondary hover:text-primary"
          >
            <ExternalLinkIcon size={13} />
            打开原链接
          </a>
        </div>
      )}
    </div>
  );
}

/** 统一链接解析入口：按链接类型分发到对应解析器 */
export function LinkParser({ url, onCodeFetched, onBatchImport, onToast, onError }: LinkParserProps) {
  const kind = useMemo(() => detectKind(url), [url]);
  if (!kind) return null;

  const hostKind = kind === 'github' || kind === 'gitee' || kind === 'gitlab' ? kind : null;

  return (
    <div className="animate-fadeIn">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-tertiary">
        <TagIcon size={12} className="text-accent" />
        已识别 {KIND_LABEL[kind]} 链接
      </div>
      {hostKind && (
        <CodeHostParser
          url={url}
          config={HOST_CONFIGS[hostKind]}
          onCodeFetched={onCodeFetched}
          onBatchImport={onBatchImport}
          onToast={onToast}
          onError={onError}
        />
      )}
      {kind === 'bilibili' && (
        <BilibiliParser url={url} onCodeFetched={onCodeFetched} onError={onError} />
      )}
      {kind === 'netdisk' && (
        <NetdiskParser url={url} onCodeFetched={onCodeFetched} onError={onError} />
      )}
      {kind === 'code' && (
        <OtherCodeParser url={url} onCodeFetched={onCodeFetched} onError={onError} />
      )}
    </div>
  );
}
