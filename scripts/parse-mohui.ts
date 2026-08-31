/**
 * 用项目解析器解析 mohui666.github.io 的 motion 实验仓库
 * 用法: npx tsx scripts/parse-mohui.ts [demo1 demo2 ...]   （不传则列出全部 demo）
 */
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import { listGithubDemos, fetchGithubDemo } from '../src/utils/github';

// Node fetch 默认不走系统代理，这里手动走 127.0.0.1:7897（Clash）
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));

const REPO_URL = 'https://github.com/mohui666/mohui666.github.io/tree/main/motion';

async function main() {
  const status = (msg: string) => console.error(`  · ${msg}`);
  console.error('列出 demo…');
  const { demos, ref } = await listGithubDemos(REPO_URL, status);
  console.error(`共 ${demos.length} 个 demo（ref=${ref}）`);

  const targets = process.argv.slice(2);
  const selected = targets.length > 0 ? demos.filter((d) => targets.includes(d.name)) : demos;

  const results: Array<{ name: string; path: string; size: number; html: string; css: string; js: string; source: string }> = [];
  for (const demo of selected) {
    try {
      const code = await fetchGithubDemo(REPO_URL, demo, status);
      results.push({
        name: demo.name,
        path: demo.path,
        size: demo.size,
        html: code.html,
        css: code.css,
        js: code.js,
        source: code.source,
      });
      console.error(`✓ ${demo.name} (html=${code.html.length}, css=${code.css.length}, js=${code.js.length})`);
    } catch (err) {
      console.error(`✗ ${demo.name}: ${(err as Error).message}`);
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('解析失败:', err);
  process.exit(1);
});
