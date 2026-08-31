import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transformSync } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '..', 'src', 'samples', 'mohui.ts'), 'utf8');

const result = transformSync(src, { loader: 'ts', format: 'esm' });
const tmp = path.join(__dirname, '.mohui-check.mjs');
writeFileSync(tmp, result.code);

const { MOHUI_COMPONENTS } = await import(pathToFileURL(tmp).href);

const problems = [];
for (let i = 0; i < MOHUI_COMPONENTS.length; i++) {
  const c = MOHUI_COMPONENTS[i];
  try {
    new Function(c.js);
  } catch (e) {
    problems.push({ i, name: c.name, error: String(e.message).slice(0, 140) });
  }
}

if (problems.length === 0) {
  console.log(`ALL ${MOHUI_COMPONENTS.length} JS OK`);
} else {
  console.log(`PROBLEMS: ${problems.length}/${MOHUI_COMPONENTS.length}`);
  for (const p of problems) console.log(`[${p.i}] ${p.name}: ${p.error}`);
}

unlinkSync(tmp);

function pathToFileURL(p) {
  return { href: 'file:///' + p.replace(/\\/g, '/') };
}
