import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Component } from '../types';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { LayersIcon, MaximizeIcon, MinimizeIcon } from '../utils/icons';

interface LivePreviewProps {
  component: Component;
}

const RESIZE_MSG = 'stylehandler-resize';
/** 统一卡片预览高度：所有卡片预览区等高，超高页面按缩略图等比缩放 */
const PREVIEW_HEIGHT = 240;
/** iframe 内部渲染高度上限，超出部分裁剪（避免超长页面缩成不可读的细条） */
const MAX_CONTENT_HEIGHT = 1200;
const MIN_CONTENT_HEIGHT = 60;

/** 构建注入 iframe 的 srcdoc */
function buildSrcDoc(component: Component): string {
  const resizeScript = `
<script>
(function () {
  var id = ${JSON.stringify(component.id)};
  function report() {
    var de = document.documentElement;
    var b = document.body;
    var h = de.scrollHeight || b.scrollHeight;
    var w = de.scrollWidth || b.scrollWidth;
    window.parent.postMessage({ type: '${RESIZE_MSG}', id: id, height: h, width: w }, '*');
  }
  if (window.ResizeObserver) {
    new ResizeObserver(report).observe(document.body);
  }
  window.addEventListener('load', report);
  setTimeout(report, 120);
})();
</script>`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; scrollbar-width: none; -ms-overflow-style: none; }
html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
</style>
<style>${component.css}</style>
</head>
<body>
${component.html}
${resizeScript}
<script>${component.js}</script>
</body>
</html>`;
}

/** iframe 实时预览：srcdoc 注入 + sandbox + 懒加载 + 高度自适应 + 全屏查看 */
export function LivePreview({ component }: LivePreviewProps) {
  const { ref, isVisible } = useIntersectionObserver<HTMLDivElement>();
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState(PREVIEW_HEIGHT);
  const [contentWidth, setContentWidth] = useState(0);
  const [boxWidth, setBoxWidth] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 懒加载：进入视口后才设置 srcdoc
  useEffect(() => {
    if (isVisible && srcDoc === null) {
      setSrcDoc(buildSrcDoc(component));
    }
  }, [isVisible, srcDoc, component]);

  // 合并 ref：懒加载观察 + 宽度测量
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref(node);
      containerRef.current = node;
    },
    [ref],
  );

  // 测量预览容器宽度（用于缩略图等比缩放）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBoxWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 监听卡片 iframe 高度/宽度上报（仅接受本卡片 iframe 的消息，忽略全屏 iframe 的视口数据）
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: string; height?: number; width?: number };
      if (data?.type !== RESIZE_MSG || data.id !== component.id || typeof data.height !== 'number') {
        return;
      }
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      setContentHeight(Math.min(Math.max(data.height, MIN_CONTENT_HEIGHT), MAX_CONTENT_HEIGHT));
      setContentWidth(typeof data.width === 'number' && data.width > 0 ? data.width : 0);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [component.id]);

  // 全屏时 ESC 关闭 + 锁定外层滚动
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  // 宽组件（内容宽超出预览区）：等比缩放到预览区内完整显示，避免右侧被裁切
  const needScale = boxWidth > 0 && contentWidth > boxWidth && contentHeight > 0;
  const scale = needScale ? Math.min(boxWidth / contentWidth, PREVIEW_HEIGHT / contentHeight) : 1;
  const iframeW = needScale ? contentWidth : boxWidth;
  const dispW = iframeW * scale;
  const dispH = contentHeight * scale;
  // 全页式组件（body 100vh）在固定 240px 高度内由自身布局居中填满；
  // 缩放/内容不超高时垂直居中，超高内容顶部对齐裁掉底部
  const alignCenter = needScale || contentHeight <= PREVIEW_HEIGHT;

  return (
    <>
      <div
        ref={setContainerRef}
        className="group/preview relative overflow-hidden border border-border bg-bg transition-transform duration-500 ease-out group-hover:scale-[1.015]"
        style={{ height: PREVIEW_HEIGHT }}
      >
        {srcDoc ? (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ display: 'flex', alignItems: alignCenter ? 'center' : 'flex-start', justifyContent: 'center' }}
          >
            <div style={{ width: dispW, height: dispH }}>
              <iframe
                ref={iframeRef}
                title={`${component.name} 预览`}
                className="block shrink-0 border-0 bg-transparent"
                style={{ width: iframeW, height: contentHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                sandbox="allow-scripts"
                srcDoc={srcDoc}
                loading="lazy"
              />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-tertiary">
            <LayersIcon size={28} />
          </div>
        )}
        {/* 全屏预览按钮：悬停预览区域时浮现 */}
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="micro-icon-btn absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center border border-border bg-bg/85 text-tertiary opacity-0 backdrop-blur transition-opacity duration-200 hover:bg-surface3 hover:text-accent focus-visible:outline-2 focus-visible:outline-focus group-hover/preview:opacity-100"
          aria-label={`全屏预览 ${component.name}`}
          title="全屏预览"
        >
          <MaximizeIcon size={14} />
        </button>
      </div>

      {/* 全屏预览覆盖层：Portal 到 body，避免被卡片的 transform/content-visibility 定位上下文裁剪 */}
      {fullscreen &&
        srcDoc &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/80 p-2 backdrop-blur-sm sm:p-4"
            onClick={() => setFullscreen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${component.name} 全屏预览`}
          >
            <div
              className="flex h-full w-full flex-col overflow-hidden border border-border bg-bg shadow-elevation2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="truncate text-xs text-secondary">{component.name} · 全屏预览</span>
                <button
                  type="button"
                  className="micro-icon-btn grid h-7 w-7 place-items-center text-tertiary hover:bg-surface3 hover:text-accent focus-visible:outline-2 focus-visible:outline-focus"
                  onClick={() => setFullscreen(false)}
                  aria-label="关闭全屏预览"
                >
                  <MinimizeIcon size={16} />
                </button>
              </div>
              <iframe
                title={`${component.name} 全屏预览`}
                className="h-full w-full flex-1 border-0 bg-transparent"
                sandbox="allow-scripts"
                srcDoc={srcDoc}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
