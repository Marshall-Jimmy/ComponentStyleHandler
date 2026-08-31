// 提取指定组件的 JS 关键交互逻辑
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { transformSync } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '..', 'src', 'samples', 'mohui.ts'), 'utf8');
const result = transformSync(src, { loader: 'ts', format: 'esm' });
const tmp = path.join(__dirname, '.mohui-extract.mjs');
writeFileSync(tmp, result.code);
const { MOHUI_COMPONENTS } = await import(pathToFileURL(tmp).href);

const targets = process.argv.slice(2).map(Number);
for (const i of targets) {
  const c = MOHUI_COMPONENTS[i - 1];
  if (!c) continue;
  console.log(`\n========== #${i} ${c.name} (js ${c.js.length}) ==========`);
  // 查找事件监听
  const listeners = [...c.js.matchAll(/(?:addEventListener|\.on)\s*\(\s*['"]([a-z]+)['"]/g)].map((m) => m[1]);
  console.log('listeners:', [...new Set(listeners)].join(', '));
  // 查找 mousemove 处理
  const mmIdx = c.js.search(/mousemove|pointermove/);
  if (mmIdx >= 0) {
    console.log('--- mousemove 附近代码 ---');
    console.log(c.js.slice(Math.max(0, mmIdx - 150), mmIdx + 250).replace(/\s+/g, ' '));
  }
  // 查找初始绘制
  const initIdx = c.js.search(/function\s+(init|start|setup|draw)\b|requestAnimationFrame/);
  if (initIdx >= 0) {
    console.log('--- 初始化/动画循环附近 ---');
    console.log(c.js.slice(Math.max(0, initIdx - 100), initIdx + 200).replace(/\s+/g, ' '));
  }
}
unlinkSync(tmp);
