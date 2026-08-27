import { useEffect, useRef, useState } from 'react';
import { highlightCode } from '../utils/highlight';

interface CodeEditorProps {
  label: string;
  value: string;
  language: 'xml' | 'css' | 'javascript';
  onChange: (value: string) => void;
}

const SHARED_CLASS =
  'm-0 w-full resize-y overflow-auto whitespace-pre break-normal font-mono text-[13px] leading-6';

/** 语法高亮代码编辑器：透明 textarea 叠加高亮 pre */
export function CodeEditor({ label, value, language, onChange }: CodeEditorProps) {
  const [highlighted, setHighlighted] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-secondary">{label}</label>
        <span className="font-mono text-[10px] text-tertiary">{language}</span>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-border bg-bg transition-colors focus-within:border-accent/60">
        <pre
          className={`${SHARED_CLASS} pointer-events-none absolute inset-0 px-3 py-2`}
          aria-hidden="true"
        >
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label={label}
          className={`${SHARED_CLASS} relative bg-transparent px-3 py-2 text-transparent caret-accent outline-none`}
        />
      </div>
    </div>
  );
}
