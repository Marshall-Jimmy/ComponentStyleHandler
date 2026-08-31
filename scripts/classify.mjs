// 精确分类每个组件的交互类型，用于预览策略算法
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { transformSync } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '..', 'src', 'samples', 'mohui.ts'), 'utf8');
const result = transformSync(src, { loader: 'ts', format: 'esm' });
const tmp = path.join(__dirname, '.mohui-classify.mjs');
writeFileSync(tmp, result.code);
const { MOHUI_COMPONENTS } = await import(pathToFileURL(tmp).href);

function classify(c) {
  const js = c.js || '';
  const html = c.html || '';
  const css = c.css || '';
  const has = (re) => re.test(js);

  // 拖拽平移：viewport/canvas/stage/object 上 pointermove 用 delta 移动
  const dragPan = /(?:viewport|canvas|stage|object|field)\.addEventListener\(["']pointermove["'][\s\S]{0,200}(?:clientX\s*-\s*lastX|localPoint|moveTarget|beginPull|movePointer|tracePath)/.test(js);
  // 磁贴悬停：tile pointerenter + is-revealed
  const tileHover = /tile\.addEventListener\(["']pointerenter/.test(js) || /pointerenter[\s\S]{0,80}is-revealed/.test(js);
  // 反应播种：seed(input.x, input.y, ...)
  const seed = /seed\(input\.x,\s*input\.y/.test(js);
  // 指针跟随：stage pointermove updatePointer
  const pointerFollow = /stage\.addEventListener\(["']pointermove["'][\s\S]{0,100}updatePointer/.test(js);
  // 窗口滚动
  const windowScroll = /window\.addEventListener\(["']scroll/.test(js);
  // 点击按钮
  const clickBtn = /querySelector\(["']\.?[a-z-]*btn[a-z-]*["']\)[\s\S]{0,100}addEventListener\(["']click/.test(js)
    || /data-action[\s\S]{0,200}addEventListener\(["']click/.test(js);
  // 自动动画（无交互依赖）
  const auto = !dragPan && !tileHover && !seed && !pointerFollow && !windowScroll && !clickBtn;

  let interaction = 'auto';
  if (dragPan) interaction = 'drag';
  else if (tileHover) interaction = 'hover';
  else if (seed) interaction = 'seed';
  else if (pointerFollow) interaction = 'follow';
  else if (windowScroll) interaction = 'scroll';
  else if (clickBtn) interaction = 'click';

  // 滚动目标：有滚动监听时，检查滚动容器
  let scrollTarget = 0.5;
  if (windowScroll) scrollTarget = 0.5;

  // 拖拽轴
  let dragAxis = 'both';
  if (dragPan) {
    const moveCode = (js.match(/function\s+move\([\s\S]{0,300}/) || [''])[0];
    if (moveCode && !/clientY|deltaY|\.y\b/.test(moveCode)) dragAxis = 'x';
  }

  return { interaction, dragAxis, scrollTarget, dragPan, tileHover, seed, pointerFollow, windowScroll, clickBtn, auto };
}

console.log('idx\tname\tinteraction\tdragAxis\tflags');
MOHUI_COMPONENTS.forEach((c, i) => {
  const r = classify(c);
  const flags = [
    r.dragPan ? 'drag' : '',
    r.tileHover ? 'hover' : '',
    r.seed ? 'seed' : '',
    r.pointerFollow ? 'follow' : '',
    r.windowScroll ? 'scroll' : '',
    r.clickBtn ? 'click' : '',
    r.auto ? 'auto' : '',
  ].filter(Boolean).join('+');
  console.log([i + 1, c.name, r.interaction, r.dragAxis, flags].join('\t'));
});

unlinkSync(tmp);
