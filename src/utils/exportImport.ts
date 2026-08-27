import type { Component } from '../types';
import { emitHook } from './events';

/**
 * 数据备份与恢复
 * 导出全部组件为 JSON 文件；导入 JSON 并与现有数据合并（按 id 去重）。
 */

const EXPORT_FILENAME = 'stylehandler-backup.json';

/** 导出数据为 JSON 文件下载 */
export function exportData(components: Component[]): void {
  const payload = {
    app: 'StyleHandler',
    version: 1,
    exportedAt: new Date().toISOString(),
    components,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = EXPORT_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  emitHook('stylehandler:export', { count: components.length });
}

/** 解析导入文件内容，返回组件数组 */
export function parseImportFile(text: string): Component[] {
  const data = JSON.parse(text) as { components?: Component[] };
  if (!Array.isArray(data.components)) {
    throw new Error('导入文件格式不正确');
  }
  return data.components.filter(
    (c): c is Component =>
      !!c && typeof c.id === 'string' && typeof c.name === 'string',
  );
}
