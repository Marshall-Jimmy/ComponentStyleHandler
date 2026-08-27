import { useEffect, useRef, useState } from 'react';
import {
  detectNetdisk,
  parseNetdisk,
  resolveDownload,
  fetchTextUrl,
  isTextFile,
  formatSize,
  extOf,
  providerName,
  type NetdiskResult,
  type NetdiskFile,
} from '../utils/netdisk';
import { ActivityFeed } from './ActivityFeed';
import { useActivity } from '../hooks/useActivity';
import {
  SpinnerIcon,
  LinkIcon,
  AlertTriangleIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  BoxIcon,
  RefreshIcon,
} from '../utils/icons';
import { copyText } from '../utils/clipboard';

interface NetdiskParserProps {
  url: string;
  onCodeFetched: (html: string, css: string, js: string, source: string) => void;
  onError: (message: string) => void;
}

type Stage = 'idle' | 'guidance' | 'parsing' | 'list' | 'fetching' | 'done' | 'error';

/** 需登录态/服务端代理，浏览器内无法匿名解析的网盘 */
function needsGuidance(provider: string | null): boolean {
  return provider === 'baidu' || provider === 'aliyun';
}

function guidanceText(provider: string | null): string {
  return provider === 'baidu'
    ? '百度网盘直链需要登录态与动态签名，浏览器内无法匿名解析。'
    : '阿里云盘直链需要服务端代理或登录态，浏览器内无法匿名解析。';
}

/** 网盘链接解析面板：粘贴网盘分享链接后自动解析直链，文本代码可直接填入编辑器 */
export function NetdiskParser({ url, onCodeFetched, onError }: NetdiskParserProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [result, setResult] = useState<NetdiskResult | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [direct, setDirect] = useState<{ url: string; name: string; text: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pwdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);
  const { items, advance, complete, markError, reset } = useActivity();

  const provider = url ? detectNetdisk(url) : null;

  const runParse = async (pwd: string) => {
    setStage('parsing');
    setError('');
    setDirect(null);
    reset();
    cancelRef.current = false;
    advance(`解析 ${providerName(provider)} 分享链接`);
    try {
      const res = await parseNetdisk(url, pwd.trim() || undefined);
      if (cancelRef.current) return;
      setResult(res);
      setStage('list');
      if (res.files.length === 1 && res.files[0].directUrl) {
        complete('直链已就绪');
      } else if (res.files.length > 0) {
        complete(`发现 ${res.files.length} 个文件`);
      } else {
        complete('分享中没有可下载的文件');
      }
    } catch (err) {
      if (cancelRef.current) return;
      markError(err instanceof Error ? err.message : '解析失败');
      setStage('error');
      setError(err instanceof Error ? err.message : '解析失败');
    }
  };

  // URL 变化后自动解析（需登录态的网盘除外）
  useEffect(() => {
    setCopied(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pwdTimerRef.current) clearTimeout(pwdTimerRef.current);
    if (!url || !detectNetdisk(url)) {
      setStage('idle');
      setResult(null);
      reset();
      return;
    }
    if (needsGuidance(provider)) {
      setStage('guidance');
      setResult(null);
      reset();
      return;
    }
    setStage('parsing');
    timerRef.current = setTimeout(() => {
      void runParse(password);
    }, 500);
    return () => {
      cancelRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pwdTimerRef.current) clearTimeout(pwdTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // 提取码变化后重新解析
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (pwdTimerRef.current) clearTimeout(pwdTimerRef.current);
    pwdTimerRef.current = setTimeout(() => {
      if (url && detectNetdisk(url) && !needsGuidance(provider)) {
        void runParse(value);
      }
    }, 600);
  };

  /** 点击文件：解析直链并抓取文本/展示下载 */
  const handleSelectFile = async (file: NetdiskFile) => {
    if (!result) return;
    setStage('fetching');
    setError('');
    reset();
    advance('解析直链');
    try {
      const directUrl = await resolveDownload(result, file);
      if (cancelRef.current) return;
      setDirect({ url: directUrl, name: file.name, text: isTextFile(file.name) });
      if (isTextFile(file.name)) {
        advance('下载文件内容');
        const text = await fetchTextUrl(directUrl);
        if (cancelRef.current) return;
        const ext = extOf(file.name);
        const isCss = ['css', 'scss', 'sass', 'less'].includes(ext);
        const isJs = ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue', 'svelte', 'json'].includes(ext);
        onCodeFetched(isCss ? '' : text, isCss ? text : '', isJs ? text : '', file.name);
        complete('内容已填入编辑器');
        setStage('done');
      } else {
        complete('直链已就绪');
        setStage('list');
        onError(`已获取直链：${file.name} 为二进制文件，请复制直链下载`);
      }
    } catch (err) {
      if (cancelRef.current) return;
      markError(err instanceof Error ? err.message : '解析失败');
      setStage('list');
      onError(err instanceof Error ? err.message : '解析失败');
    }
  };

  const handleCopyDirect = async () => {
    if (!direct) return;
    const ok = await copyText(direct.url);
    setCopied(ok);
    if (!ok) onError('复制失败');
  };

  if (stage === 'idle') return null;

  const isBusy = stage === 'parsing' || stage === 'fetching';

  return (
    <div className="space-y-2 rounded-lg border border-border bg-bg p-3 animate-fadeIn">
      <ActivityFeed items={items} />
      {/* 头部：网盘标识 + 提取码 */}
      {(stage === 'list' || stage === 'done' || stage === 'error') && provider && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-secondary">
            <LinkIcon size={14} className="text-accent" />
            {providerName(provider)}
          </span>
          <input
            type="text"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder="提取码（可选）"
            className="w-28 border border-border bg-surface1 px-2 py-1 text-xs text-primary outline-none placeholder:text-tertiary focus:border-accent/60"
          />
        </div>
      )}

      {/* 需要登录态的网盘引导 */}
      {stage === 'guidance' && provider && (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 text-xs text-secondary">
            <AlertTriangleIcon size={14} className="mt-0.5 shrink-0 text-warning" />
            <span>
              <span className="font-medium text-primary">{providerName(provider)}</span>
              {guidanceText(provider)}该网盘需要账号登录或服务端代理才能获取真实下载地址，可打开分享页直接下载。
            </span>
          </p>
          <div className="flex gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="micro-btn flex items-center gap-1.5 border border-border bg-surface1 px-2.5 py-1.5 text-xs text-secondary hover:border-accent/50 hover:text-primary"
            >
              <ExternalLinkIcon size={13} />
              打开分享页
            </a>
          </div>
        </div>
      )}

      {/* 解析中 */}
      {stage === 'parsing' && (
        <div className="flex items-center gap-2 text-sm text-secondary">
          <span className="animate-spin text-accent">
            <SpinnerIcon size={18} />
          </span>
          正在解析网盘链接…
        </div>
      )}

      {/* 文件列表 */}
      {stage === 'list' && result && (
        <div className="space-y-1">
          {result.files.length === 0 ? (
            <p className="text-xs text-tertiary">该分享中没有可下载的文件</p>
          ) : (
            result.files.map((file) => (
              <button
                key={file.fileId ?? file.name}
                type="button"
                disabled={isBusy}
                onClick={() => handleSelectFile(file)}
                className="micro-item flex w-full items-center gap-2 border border-border bg-surface1 px-2.5 py-2 text-left text-xs hover:border-accent/50 disabled:opacity-50"
              >
                <BoxIcon size={14} className="shrink-0 text-tertiary" />
                <span className="min-w-0 flex-1 truncate text-secondary">{file.name}</span>
                {file.size !== undefined && (
                  <span className="shrink-0 text-tertiary">{formatSize(file.size)}</span>
                )}
                {file.directUrl ? (
                  <span className="shrink-0 text-accent">直链已就绪</span>
                ) : (
                  <span className="shrink-0 text-tertiary">
                    {isTextFile(file.name) ? '抓取' : '解析'}
                  </span>
                )}
              </button>
            ))
          )}
          <p className="text-[11px] text-tertiary">点击文件：文本/代码自动填入编辑器，二进制文件解析直链</p>
        </div>
      )}

      {/* 解析直链中 */}
      {stage === 'fetching' && (
        <div className="flex items-center gap-2 text-sm text-secondary">
          <span className="animate-spin text-accent">
            <SpinnerIcon size={18} />
          </span>
          正在解析直链…
        </div>
      )}

      {/* 已填入编辑器 */}
      {stage === 'done' && direct && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckIcon size={16} />
            <span className="truncate">{direct.name}</span> 已填入编辑器
          </p>
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 truncate border border-border bg-surface1 px-2 py-1 text-[11px] text-tertiary">
              {direct.url}
            </code>
            <button
              type="button"
              onClick={handleCopyDirect}
              className="micro-btn flex shrink-0 items-center gap-1 border border-border bg-surface1 px-2 py-1 text-[11px] text-secondary hover:border-accent/50 hover:text-primary"
            >
              <CopyIcon size={12} />
              {copied ? '已复制' : '复制直链'}
            </button>
            <a
              href={direct.url}
              target="_blank"
              rel="noreferrer"
              className="micro-btn flex shrink-0 items-center gap-1 border border-border bg-surface1 px-2 py-1 text-[11px] text-secondary hover:border-accent/50 hover:text-primary"
            >
              <DownloadIcon size={12} />
              下载
            </a>
          </div>
        </div>
      )}

      {/* 错误 */}
      {stage === 'error' && (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 text-sm text-danger">
            <AlertTriangleIcon size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
          <button
            type="button"
            onClick={() => runParse(password)}
            className="micro-btn flex items-center gap-1.5 border border-border bg-surface1 px-2.5 py-1.5 text-xs text-secondary hover:border-accent/50 hover:text-primary"
          >
            <RefreshIcon size={13} />
            重新解析
          </button>
        </div>
      )}
    </div>
  );
}
