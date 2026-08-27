import { isBilibiliUrl } from './bilibili';
import { isGithubUrl } from './github';
import { isGiteeUrl } from './gitee';
import { isGitlabUrl } from './gitlab';
import { detectNetdisk, providerName } from './netdisk';

/** 判断是否为 CodePen / jsFiddle 等代码托管站 */
function isCodeHostUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === 'codepen.io' ||
    host.endsWith('.codepen.io') ||
    host === 'jsfiddle.net' ||
    host.endsWith('.jsfiddle.net')
  );
}

/** 根据来源 URL 推断自动标签 */
export function detectSourceTag(url: string): string {
  const trimmed = url?.trim();
  if (!trimmed) return '本地';
  if (isGithubUrl(trimmed)) return 'GitHub';
  if (isGiteeUrl(trimmed)) return 'Gitee';
  if (isGitlabUrl(trimmed)) return 'GitLab';
  if (isBilibiliUrl(trimmed)) return 'B站';
  const netdisk = detectNetdisk(trimmed);
  if (netdisk) return providerName(netdisk);
  if (isCodeHostUrl(trimmed)) return 'CodePen';
  return '外部';
}
