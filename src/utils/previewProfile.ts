import type { Component } from '../types';

/**
 * 预览策略算法：静态分析组件代码，自动推导最优的卡片预览方式。
 * 将"人工逐个调优卡片"的过程算法化：分类交互类型 → 选择交互脚本 → 确定取景/滚动。
 */

export type InteractionMode = 'seed' | 'drag' | 'hover' | 'follow' | 'scroll' | 'auto';

export interface PreviewProfile {
  /** 交互类型 */
  interaction: InteractionMode;
  /** 滚动目标比例 0-1（scroll 类组件） */
  scrollTarget: number;
  /** seed 类：是否多点按下播种，制造更丰富的反应 */
  multiSeed: boolean;
  /** drag 类：拖拽距离（相对视口宽度的比例） */
  dragDistance: number;
}

const cache = new WeakMap<Component, PreviewProfile>();

/** 分析组件并返回预览策略（结果按组件缓存） */
export function getPreviewProfile(component: Component): PreviewProfile {
  const cached = cache.get(component);
  if (cached) return cached;
  const profile = analyze(component);
  cache.set(component, profile);
  return profile;
}

function analyze(component: Component): PreviewProfile {
  const js = component.js || '';

  // 反应播种：canvas 上 pointerdown 播种能量源
  const seed = /seed\(input\.x,\s*input\.y/.test(js);
  // 拖拽平移/物理：pointermove 用 delta 移动对象或平移视口
  const drag =
    /(?:viewport|canvas|stage|object|field)\.addEventListener\(["']pointermove["'][\s\S]{0,200}(?:clientX\s*-\s*lastX|localPoint|moveTarget|beginPull|movePointer|tracePath)/.test(
      js,
    );
  // 磁贴悬停：tile pointerenter 触发揭示
  const hover = /tile\.addEventListener\(["']pointerenter/.test(js) || /pointerenter[\s\S]{0,80}is-revealed/.test(js);
  // 指针跟随：stage pointermove 更新流场
  const follow = /stage\.addEventListener\(["']pointermove["'][\s\S]{0,100}updatePointer/.test(js);
  // 窗口滚动驱动
  const scroll = /window\.addEventListener\(["']scroll/.test(js);

  let interaction: InteractionMode = 'auto';
  if (seed) interaction = 'seed';
  else if (drag) interaction = 'drag';
  else if (hover) interaction = 'hover';
  else if (follow) interaction = 'follow';
  else if (scroll) interaction = 'scroll';

  return {
    interaction,
    scrollTarget: scroll ? 0.5 : 0,
    multiSeed: seed,
    dragDistance: drag ? 0.3 : 0,
  };
}
