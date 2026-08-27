/**
 * 全局类型定义
 * 数据模型设计为可扩展：未来可增加 framework、category 等字段而不破坏现有代码。
 */

/** 收藏的组件 */
export interface Component {
  id: string;
  /** 组件名称（必填） */
  name: string;
  /** 来源 URL（可选） */
  url?: string;
  /** 标签列表 */
  tags: string[];
  /** HTML 代码 */
  html: string;
  /** CSS 代码 */
  css: string;
  /** JavaScript 代码（仅作字符串存储） */
  js: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/** 新建/编辑组件时的表单数据 */
export interface ComponentDraft {
  name: string;
  url: string;
  tags: string;
  html: string;
  css: string;
  js: string;
}

/** Toast 消息 */
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

/** AI 配置 */
export interface AIKeys {
  provider: 'openai' | 'claude';
  openaiKey: string;
  claudeKey: string;
}

/** AI 转换目标格式 */
export type ConvertTarget = 'React' | 'Vue' | 'Tailwind';

/** 从 B 站解析出的候选链接 */
export interface ParsedLink {
  url: string;
  label: string;
  type: 'code' | 'netdisk' | 'other';
  /** 网盘提取码 */
  password?: string;
}

/** 解析进度阶段 */
export type ParseStage = 'idle' | 'fetching' | 'links' | 'fetchingCode' | 'done' | 'error';
