// 分析 mohui.ts 中每个组件的交互类型与初始渲染特征
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { transformSync } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '..', 'src', 'samples', 'mohui.ts'), 'utf8');

const result = transformSync(src, { loader: 'ts', format: 'esm' });
const tmp = path.join(__dirname, '.mohui-analyze.mjs');
writeFileSync(tmp, result.code);
const { MOHUI_COMPONENTS } = await import(pathToFileURL(tmp).href);

const rows = [];
for (let i = 0; i < MOHUI_COMPONENTS.length; i++) {
  const c = MOHUI_COMPONENTS[i];
  const js = c.js || '';
  const css = c.css || '';
  const html = c.html || '';

  const has = (re) => re.test(js);
  const interact = {
    mousemove: has(/mousemove|pointermove|pointerPosition|clientX|clientY/),
    mousedown: has(/mousedown|pointerdown|mousedown|pointerdown/),
    mouseup: has(/mouseup|pointerup/),
    click: has(/\.click|addEventListener\(['"]click|onclick/),
    scroll: has(/scroll|wheel/),
    drag: has(/drag|pointerdown[\s\S]{0,200}pointermove/),
    touch: has(/touchstart|touchmove/),
    rAF: has(/requestAnimationFrame/),
    canvas: has(/getContext\(['"]2d|getContext\(['"]webgl|WebGL|createShader/),
    resize: has(/resize/),
  };
  const jsLen = js.length;
  const cssLen = css.length;
  const htmlLen = html.length;
  // 初始可见性：body 背景色
  const bodyBg = (css.match(/body\s*\{[^}]*background[^;]*;/) || [''])[0].slice(0, 80);
  rows.push({
    i: i + 1,
    name: c.name,
    jsLen,
    cssLen,
    htmlLen,
    ...interact,
    bodyBg,
  });
}

console.log('idx\tname\tjsLen\tmousemove\tmousedown\tclick\tscroll\tdrag\tcanvas\trAF\tbodyBg');
for (const r of rows) {
  console.log(
    [r.i, r.name, r.jsLen, r.mousemove ? 'Y' : '-', r.mousedown ? 'Y' : '-', r.click ? 'Y' : '-', r.scroll ? 'Y' : '-', r.drag ? 'Y' : '-', r.canvas ? 'Y' : '-', r.rAF ? 'Y' : '-', r.bodyBg.replace(/\s+/g, ' ')].join('\t'),
  );
}

unlinkSync(tmp);
