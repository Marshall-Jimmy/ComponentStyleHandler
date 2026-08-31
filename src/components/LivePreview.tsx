import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Component } from '../types';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { getPreviewProfile, type InteractionMode, type PreviewProfile } from '../utils/previewProfile';
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

/** 按交互类型生成自动交互脚本：seed 多点播种 / drag 拖拽 / hover·follow 指针扫掠 / scroll 滚动 */
function buildInteractBody(mode: InteractionMode, profile: PreviewProfile): string {
  switch (mode) {
    case 'seed':
      // 多点按下播种，制造更丰富的反应（单点只会在中心产生一小团）
      return `var seeds = [[0.5,0.5],[0.66,0.36],[0.34,0.64],[0.58,0.44],[0.42,0.56]];
seeds.forEach(function (p, i) {
  setTimeout(function () {
    fire('pointerdown', w * p[0], h * p[1], 1);
    setTimeout(function () { fire('pointerup', w * p[0], h * p[1], 0); }, 140);
  }, t + i * 180);
});`;
    case 'drag':
      // 按住后大幅拖拽，展示平移/物理效果
      return `var x0 = w * 0.5, y0 = h * 0.5;
fire('pointerdown', x0, y0, 1);
var pts = [[0.28,0.5],[0.72,0.5],[0.5,0.28],[0.5,0.72],[0.5,0.5]];
pts.forEach(function (p, i) {
  setTimeout(function () { fire('pointermove', w * p[0], h * p[1], 1); }, t + i * 150);
});
setTimeout(function () { fire('pointerup', w * 0.5, h * 0.5, 0); }, t + pts.length * 150 + 120);`;
    case 'scroll':
      return `var max = Math.max(0, (document.body.scrollHeight || h) - h);
if (max > 0) {
  window.scrollTo(0, max * ${profile.scrollTarget});
  window.dispatchEvent(new Event('scroll'));
}`;
    case 'hover':
    case 'follow':
    case 'auto':
    default:
      // 指针扫掠，触发磁贴悬停揭示 / 流场跟随 / 拖尾
      return `var pts = [[0.5,0.5],[0.62,0.38],[0.38,0.62],[0.66,0.34],[0.34,0.66],[0.5,0.5]];
pts.forEach(function (p, i) {
  setTimeout(function () { fire('pointermove', w * p[0], h * p[1], 0); }, t + i * 130);
});`;
  }
}

/** 生成注入 iframe 的自动交互脚本 */
function buildInteractScript(profile: PreviewProfile): string {
  const body = buildInteractBody(profile.interaction, profile);
  return `<script>
(function () {
  var lastEl = null;
  function fire(type, x, y, buttons) {
    var init = {
      clientX: x, clientY: y, pointerType: 'mouse', isPrimary: true,
      pointerId: 1, button: 0, buttons: buttons,
      bubbles: true, cancelable: true
    };
    var evt;
    try { evt = new PointerEvent(type, init); }
    catch (e) { evt = new MouseEvent(type, init); }
    window.dispatchEvent(evt);
    document.dispatchEvent(evt);
    var el = document.elementFromPoint(x, y);
    if (el) {
      el.dispatchEvent(evt);
      // 合成事件不会自动派发 pointerenter/leave，这里手动模拟以触发磁贴悬停揭示
      if (type === 'pointermove' && el !== lastEl) {
        if (lastEl) lastEl.dispatchEvent(new PointerEvent('pointerleave', init));
        el.dispatchEvent(new PointerEvent('pointerenter', init));
        lastEl = el;
      }
    }
  }
  function run() {
    var w = window.innerWidth || 1920;
    var h = window.innerHeight || 1080;
    var t = 200;
    ${body}
  }
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
  setTimeout(run, 400);
})();
</script>`;
}

/** 构建注入 iframe 的 srcdoc */
function buildSrcDoc(component: Component): string {
  const profile = getPreviewProfile(component);
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
${buildInteractScript(profile)}
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
      // 全屏式组件（viewport 标记）固定视口渲染，忽略高度上报
      const vp = component.viewport;
      if (vp && vp.width > 0 && vp.height > 0) return;
      setContentHeight(Math.min(Math.max(data.height, MIN_CONTENT_HEIGHT), MAX_CONTENT_HEIGHT));
      setContentWidth(typeof data.width === 'number' && data.width > 0 ? data.width : 0);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [component.id, component.viewport]);

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

  // 全屏式组件（viewport 标记）：按固定视口渲染，再缩略图等比缩放填充预览区（cover，居中裁切溢出）；
  // 普通组件：宽组件等比缩放，超高页面顶部对齐裁掉底部
  const viewport = component.viewport;
  const vw = viewport?.width ?? 0;
  const vh = viewport?.height ?? 0;
  const isViewport = vw > 0 && vh > 0;
  const needScale = !isViewport && boxWidth > 0 && contentWidth > boxWidth && contentHeight > 0;
  const scale = isViewport
    ? boxWidth > 0
      ? Math.max(boxWidth / vw, PREVIEW_HEIGHT / vh)
      : 1
    : needScale
      ? Math.min(boxWidth / contentWidth, PREVIEW_HEIGHT / contentHeight)
      : 1;
  const iframeW = isViewport ? vw : needScale ? contentWidth : boxWidth;
  const iframeH = isViewport ? vh : contentHeight;
  const dispW = iframeW * scale;
  const dispH = iframeH * scale;
  // 全页式组件（body 100vh）在固定 240px 高度内由自身布局居中填满；
  // 缩放/内容不超高时垂直居中，超高内容顶部对齐裁掉底部
  const alignCenter = isViewport || needScale || contentHeight <= PREVIEW_HEIGHT;

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
                style={{ width: iframeW, height: iframeH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
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
            className="fixed inset-0 z-50 animate-fadeIn bg-black/80 p-2 backdrop-blur-sm sm:p-4"
            onClick={() => setFullscreen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${component.name} 全屏预览`}
          >
            <div
              className="flex h-full w-full animate-scaleIn flex-col overflow-hidden border border-border bg-bg shadow-elevation2"
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
