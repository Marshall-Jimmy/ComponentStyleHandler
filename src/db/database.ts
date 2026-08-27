import Dexie, { type Table } from 'dexie';
import type { Component } from '../types';

/**
 * IndexedDB 数据层
 * 使用 Dexie.js 简化操作；数据库损坏时自动重置并提示用户。
 */
class StyleHandlerDB extends Dexie {
  components!: Table<Component, string>;

  constructor() {
    super('stylehandler-db');
    this.version(1).stores({
      // 索引：id 为主键，name / createdAt / updatedAt 可查询
      components: 'id, name, createdAt, updatedAt',
    });
  }
}

export const db = new StyleHandlerDB();

/** 数据库损坏时重置并返回是否成功 */
export async function resetDatabase(): Promise<boolean> {
  try {
    await db.delete();
    await db.open();
    return true;
  } catch {
    return false;
  }
}

/** 生成唯一 id */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
