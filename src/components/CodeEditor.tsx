import { useEffect, useRef, useState } from 'react';
import { highlightCode } from '../utils/highlight';

interface CodeEditorProps {
  label: string;
  value: string;
  language: 'xml' | 'css' | 'javascript';
  onChange: (value: string) => void;
}

const BASE_CLASS =
  'm-0 w-full resize-y whitespace-pre break-normal font-mono text-[13px] leading-6';
const PRE_CLASS = `${BASE_CLASS} pointer-events-none absolute inset-0 overflow-hidden px-3 py-2`;
const TA_CLASS = `${BASE_CLASS} relative overflow-auto bg-transparent px-3 py-2 text-transparent caret-accent outline-none`;

/** 语法高亮代码编辑器：透明 textarea 叠加高亮 pre，滚动时同步高亮层避免文字错位重叠 */
export function CodeEditor({ label, value, language, onChange }: CodeEditorProps) {
  const [highlighted, setHighlighted] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  // 异步高亮（语言包按需加载）
  useEffect(() => {
    let cancelled = false;
    highlightCode(value, language).then((html) => {
      if (!cancelled) setHighlighted(html);
    });
    return () => {
      cancelled = true;
    };
  }, [value, language]);

  /** 高亮层跟随 textarea 滚动，保证对齐 */
  const handleScroll = () => {
    const ta = textareaRef.current;
    const pre = preRef.current;
    if (!ta || !pre) return;
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-secondary">{label}</label>
        <span className="font-mono text-[10px] text-tertiary">{language}</span>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-border bg-bg transition-colors focus-within:border-accent/60">
        <pre
          ref={preRef}
          className={PRE_CLASS}
          aria-hidden="true"
        >
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          aria-label={label}
          className={TA_CLASS}
        />
      </div>
    </div>
  );
}
