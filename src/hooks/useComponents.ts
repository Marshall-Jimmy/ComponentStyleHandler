import { useCallback, useEffect, useState } from 'react';
import { db, resetDatabase, generateId } from '../db/database';
import type { Component, ComponentDraft } from '../types';
import { sanitizeHtml, sanitizeCss } from '../utils/sanitize';
import { detectSourceTag } from '../utils/source';
import { emitHook } from '../utils/events';
import { SAMPLE_COMPONENTS } from '../samples';

/**
 * 组件数据管理 Hook
 * 封装 IndexedDB 的增删改查，首次加载无数据时注入示例组件。
 */

export function useComponents() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  /** 从 IndexedDB 读取全部组件 */
  const load = useCallback(async () => {
    try {
      const all = await db.components.orderBy('createdAt').reverse().toArray();
      setComponents(all);
      setDbError(null);
    } catch (err) {
      setDbError('数据库读取失败，请点击重试');
      console.error('读取数据库失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 首次加载：若无数据则注入示例组件 */
  const seedIfEmpty = useCallback(async () => {
    try {
      const count = await db.components.count();
      if (count === 0) {
        const now = Date.now();
        const seeds: Component[] = SAMPLE_COMPONENTS.map((s, i) => ({
          ...s,
          id: generateId(),
          createdAt: now - i,
          updatedAt: now - i,
        }));
        await db.components.bulkAdd(seeds);
        await load();
      }
    } catch (err) {
      console.error('注入示例组件失败', err);
    }
  }, [load]);

  useEffect(() => {
    if (!loading) {
      void seedIfEmpty();
    }
  }, [loading, seedIfEmpty]);

  /** 保存组件（新建或更新），返回保存后的组件 */
  const saveComponent = useCallback(
    async (draft: ComponentDraft, existing?: Component): Promise<Component> => {
      const now = Date.now();
      const manualTags = draft.tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);
      // 自动附加来源标签，让组件在「全部」与来源标签筛选下都能看到
      const sourceTag = detectSourceTag(draft.url.trim());
      const tags =
        sourceTag && !manualTags.some((t) => t.toLowerCase() === sourceTag.toLowerCase())
          ? [...manualTags, sourceTag]
          : manualTags;
      const component: Component = {
        id: existing?.id ?? generateId(),
        name: draft.name.trim(),
        url: draft.url.trim() || undefined,
        tags,
        html: sanitizeHtml(draft.html),
        css: sanitizeCss(draft.css),
        js: draft.js,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await db.components.put(component);
      await load();
      emitHook('stylehandler:save', { component });
      return component;
    },
    [load],
  );

  /** 删除组件 */
  const deleteComponent = useCallback(
    async (id: string) => {
      await db.components.delete(id);
      await load();
      emitHook('stylehandler:delete', { count: components.length - 1 });
    },
    [load, components.length],
  );

  /** 批量导入组件（按 id 去重合并） */
  const importComponents = useCallback(
    async (incoming: Component[]) => {
      const existing = await db.components.toArray();
      const existingIds = new Set(existing.map((c) => c.id));
      const fresh = incoming.filter((c) => !existingIds.has(c.id));
      if (fresh.length > 0) {
        await db.components.bulkPut(fresh);
      }
      await load();
      emitHook('stylehandler:import', { count: fresh.length });
      return fresh.length;
    },
    [load],
  );

  /** 重置数据库 */
  const reset = useCallback(async () => {
    const ok = await resetDatabase();
    if (ok) {
      await load();
      await seedIfEmpty();
    }
    return ok;
  }, [load, seedIfEmpty]);

  /** 关闭数据库错误横幅 */
  const dismissDbError = useCallback(() => setDbError(null), []);

  return {
    components,
    loading,
    dbError,
    saveComponent,
    deleteComponent,
    importComponents,
    reset,
    reload: load,
    dismissDbError,
  };
}
