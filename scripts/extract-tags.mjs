// 提取所有组件的名称与标签
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { transformSync } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '..', 'src', 'samples', 'mohui.ts'), 'utf8');
const result = transformSync(src, { loader: 'ts', format: 'esm' });
const tmp = path.join(__dirname, '.mohui-tags.mjs');
writeFileSync(tmp, result.code);
const { MOHUI_COMPONENTS } = await import(pathToFileURL(tmp).href);

for (let i = 0; i < MOHUI_COMPONENTS.length; i++) {
  const c = MOHUI_COMPONENTS[i];
  console.log(`${i + 1}\t${c.name}\t${c.tags.join('/')}`);
}
unlinkSync(tmp);
