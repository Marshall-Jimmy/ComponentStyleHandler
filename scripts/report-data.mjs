// 生成完整分类数据，用于总结报告
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { transformSync } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '..', 'src', 'samples', 'mohui.ts'), 'utf8');
const result = transformSync(src, { loader: 'ts', format: 'esm' });
const tmp = path.join(__dirname, '.mohui-report.mjs');
writeFileSync(tmp, result.code);
const { MOHUI_COMPONENTS } = await import(pathToFileURL(tmp).href);

const rows = [];
for (let i = 0; i < MOHUI_COMPONENTS.length; i++) {
  const c = MOHUI_COMPONENTS[i];
  const js = c.js || '';
  const seed = /seed\(input\.x,\s*input\.y/.test(js);
  const drag =
    /(?:viewport|canvas|stage|object|field)\.addEventListener\(["']pointermove["'][\s\S]{0,200}(?:clientX\s*-\s*lastX|localPoint|moveTarget|beginPull|movePointer|tracePath)/.test(js);
  const hover = /tile\.addEventListener\(["']pointerenter/.test(js) || /pointerenter[\s\S]{0,80}is-revealed/.test(js);
  const follow = /stage\.addEventListener\(["']pointermove["'][\s\S]{0,100}updatePointer/.test(js);
  const scroll = /window\.addEventListener\(["']scroll/.test(js);
  const canvas = /getContext\(["']2d|getContext\(["']webgl|WebGL|createShader/.test(js);
  let type = 'auto';
  if (seed) type = 'seed';
  else if (drag) type = 'drag';
  else if (hover) type = 'hover';
  else if (follow) type = 'follow';
  else if (scroll) type = 'scroll';
  const tech = canvas ? 'canvas' : 'dom';
  rows.push({ i: i + 1, name: c.name, type, tech, tags: c.tags.join('/') });
}

console.log('idx\tname\ttype\ttech\ttags');
for (const r of rows) console.log([r.i, r.name, r.type, r.tech, r.tags].join('\t'));

unlinkSync(tmp);
