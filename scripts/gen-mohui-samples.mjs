/**
 * 从解析结果生成 src/samples/mohui.ts
 * 用法: node scripts/gen-mohui-samples.mjs <parsed.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , jsonPath] = process.argv;
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));

// 名称与交互标签（来自 motion 站点 index 的中文标题）
const META = {
  'fluid-distortion': ['交互式流体扭曲', '指针交互'],
  'fullscreen-expansion': ['全屏扩展转场', '滚动'],
  'scroll-scenes': ['滚动驱动场景切换', '滚动'],
  'kinetic-typography': ['动态排版', '滚动'],
  'metaballs': ['融球 / 黏性融合', '指针交互'],
  'image-motion-trail': ['图像运动拖尾', '指针交互'],
  'magnetic-cursor': ['磁吸光标', '指针交互'],
  'fullscreen-crosshair': ['全屏十字准星', '指针交互'],
  'direction-aware-reveal': ['方向感知悬停揭示', '悬停'],
  'direction-aware-marquee': ['方向感知跑马灯', '悬停'],
  'tilt-hover': ['倾斜悬停与指针视差', '指针交互'],
  'svg-path-morphing': ['SVG 路径形变', '交互控制'],
  'svg-stroke-drawing': ['SVG 路径描边', '指针交互'],
  'svg-mask-reveal': ['SVG 蒙版揭示', '指针交互'],
  'css-motion-path': ['CSS 运动路径', '交互控制'],
  'split-text-reveal': ['分割文字蒙版揭示', '点击'],
  'flip-layout-transition': ['FLIP 布局转场', '点击'],
  'shared-element-transition': ['共享元素视图转场', '点击'],
  'infinite-canvas': ['无限可平移画布', '拖拽'],
  'inertial-drag': ['惯性拖拽', '拖拽'],
  'drag-parallax-carousel': ['拖拽驱动视差轮播', '拖拽'],
  'horizontal-scroll': ['纵向滚动驱动横向轨道', '滚动'],
  'parallax-depth-scroll': ['视差深度滚动', '滚动'],
  'layered-zoom-scroll': ['分层推镜滚动', '滚动'],
  'scroll-3d-stack': ['滚动驱动三维卡片堆栈', '滚动'],
  'scroll-svg-morph': ['滚动驱动 SVG 路径形变', '滚动'],
  'reaction-diffusion': ['反应–扩散模拟', '指针交互'],
  'sdf-ray-marching': ['距离场光线步进', 'WebGL'],
  'gpgpu-particles': ['GPU 程序化粒子流场', '指针交互'],
  'lens-refraction': ['WebGL 透镜折射', '指针交互'],
  'rgb-shift': ['RGB 通道偏移与色差', '指针交互'],
  'afterimage-feedback': ['残像反馈', '指针交互'],
  'volumetric-god-rays': ['体积光束', '指针交互'],
  'morph-targets': ['三维形态目标动画', '点击'],
  'spring-drag': ['二阶弹簧跟随拖拽', '弹簧'],
  'elastic-bounds': ['弹性边界与撞墙回弹', '弹性'],
  'momentum-throw': ['速度采样与动量投掷', '动量'],
  'inertial-snap-grid': ['惯性预测与网格吸附', '吸附'],
  'magnetic-docking': ['距离磁力与停靠锁定', '磁力'],
  'rope-constraint': ['绳段长度约束拖拽', '约束'],
  'collision-drag': ['多物体碰撞与投掷', '碰撞'],
  'orbital-drag': ['轨道约束与角动量', '轨道'],
  'rubber-band-drag': ['渐进阻力与橡皮筋回弹', '阻力'],
  'physics-reorder': ['弹簧让位式拖拽重排', '重排'],
};

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const entries = data
  .filter((d) => META[d.name])
  .map((d) => {
    const [name, tag] = META[d.name];
    const url = `https://github.com/mohui666/mohui666.github.io/blob/main/motion/${d.name}/index.html`;
    return `  {
    name: '${name}',
    url: '${url}',
    tags: ['动效', '${tag}'],
    viewport: { width: 1920, height: 1080 },
    html: \`${esc(d.html)}\`,
    css: \`${esc(d.css)}\`,
    js: \`${esc(d.js)}\`,
  },`;
  });

const out = `import type { Component } from '../types';

/**
 * mohui666.github.io/motion 交互动效实验示例（全 44 个）
 * 由项目解析器（listGithubDemos + fetchGithubDemo）从仓库自动解析生成，
 * 外部 CSS/JS/webp 图片已内联为自包含代码；全屏式实验以 viewport 标记固定 1920×1080 视口渲染。
 */
export const MOHUI_COMPONENTS: Omit<Component, 'id' | 'createdAt' | 'updatedAt'>[] = [
${entries.join('\n')}
];
`;

writeFileSync(new URL('../src/samples/mohui.ts', import.meta.url), out, 'utf8');
console.log(`已生成 src/samples/mohui.ts，共 ${entries.length} 个组件`);
