import { useEffect, useRef, useState } from 'react';
import type { Component } from '../types';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { LayersIcon } from '../utils/icons';

interface LivePreviewProps {
  component: Component;
}

const RESIZE_MSG = 'stylehandler-resize';

/** 构建注入 iframe 的 srcdoc */
function buildSrcDoc(component: Component): string {
  const resizeScript = `
<script>
(function () {
  var id = ${JSON.stringify(component.id)};
  function report() {
    var h = document.documentElement.scrollHeight || document.body.scrollHeight;
    window.parent.postMessage({ type: '${RESIZE_MSG}', id: id, height: h }, '*');
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
body { margin: 0; padding: 16px; }
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

/** iframe 实时预览：srcdoc 注入 + sandbox + 懒加载 + 高度自适应 */
export function LivePreview({ component }: LivePreviewProps) {
  const { ref, isVisible } = useIntersectionObserver<HTMLDivElement>();
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [height, setHeight] = useState(180);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 懒加载：进入视口后才设置 srcdoc
  useEffect(() => {
    if (isVisible && srcDoc === null) {
      setSrcDoc(buildSrcDoc(component));
    }
  }, [isVisible, srcDoc, component]);

  // 监听 iframe 高度上报
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: string; height?: number };
      if (data?.type === RESIZE_MSG && data.id === component.id && typeof data.height === 'number') {
        setHeight(Math.min(Math.max(data.height, 60), 480));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [component.id]);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-xl border border-border bg-bg"
      style={{ height }}
    >
      {srcDoc ? (
        <iframe
          ref={iframeRef}
          title={`${component.name} 预览`}
          className="absolute inset-0 h-full w-full border-0 bg-transparent"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-tertiary">
          <LayersIcon size={28} />
        </div>
      )}
    </div>
  );
}
