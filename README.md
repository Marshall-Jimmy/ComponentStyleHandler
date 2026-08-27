# StyleHandler · ComponentStyleHandler

一个用于**收藏、预览与导出**前端组件（按钮、开关、卡片等）的单页应用。所有 UI 图标均使用内联 SVG 绘制，无任何 emoji；具备丝滑动画、离线可用、数据持久化、B 站链接智能解析与 AI API 集成能力。

![技术栈](https://img.shields.io/badge/React-18.3-%230B0B0C) ![Vite](https://img.shields.io/badge/Vite-5-%23E6B450) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-%23E6B450) ![Tailwind](https://img.shields.io/badge/Tailwind-3-%23E6B450)

---

## 功能一览

- **卡片墙主页**：响应式 Grid 网格（每列最小 280px），每张卡片包含 iframe 实时预览（`srcdoc` + `sandbox="allow-scripts"`，高度自适应）、名称/标签/来源链接元信息、复制/编辑/删除三个 SVG 操作按钮。卡片 hover 轻微上浮。
- **添加 / 编辑模态框**：聚焦时 SVG 描边动画的输入框、三栏语法高亮代码编辑器（HTML / CSS / JS）、保存时 DOMPurify 清洗 HTML 与 CSS 防止存储型 XSS。保存后新卡片插入顶部并触发滑入动画。
- **B 站链接智能解析**：粘贴 `bilibili.com/video/BV...` 或 `b23.tv/...` 链接后自动解析视频简介与热评，提取 CodePen / GitHub Gist / 网盘链接；支持自动抓取 CodePen 与 Gist 代码填入编辑器，网盘链接识别提取码并引导手动复制。公共 CORS 代理自动降级。
- **AI API 集成**：设置页配置 OpenAI / Claude API Key（仅存 localStorage，直连官方端点）。提供「清理代码」「转换格式（React / Vue / Tailwind）」「导出 Prompt」三个功能，请求时显示 SVG 环形进度条，错误友好提示。
- **搜索与筛选**：顶部搜索框实时过滤（300ms 防抖），侧边栏 SVG 圆角标签云点击筛选。
- **数据持久化与备份**：Dexie.js + IndexedDB 存储，支持导出 / 导入 JSON 备份，首次加载自动注入示例组件。
- **安全**：DOMPurify 清洗、iframe 沙箱隔离、API Key 仅本地、外部请求 HTTPS + 10s 超时。
- **鲁棒性**：全局错误捕获横幅、数据库损坏自动重置、请求超时自动取消、`prefers-reduced-motion` 尊重系统设置。

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 生产构建（输出到 dist/，可部署到任意静态服务器）
npm run build

# 本地预览构建产物
npm run preview

# 代码检查（ESLint，无未使用变量、无 console.log）
npm run lint
```

## 部署

`npm run build` 生成 `dist/` 目录，内容为纯静态文件，可部署到任意静态服务器：

```bash
# 例如使用 vercel / netlify / nginx 等
npx serve dist
```

## 项目结构

```
StyleHandler/
├── index.html               # 入口 HTML
├── vite.config.ts           # Vite 配置
├── tailwind.config.js       # Tailwind 配置（颜色映射到 CSS 变量）
├── postcss.config.js
├── .eslintrc.cjs            # ESLint 配置
├── tsconfig.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx             # 应用入口
    ├── App.tsx              # 根组件（布局、状态编排、全局错误捕获）
    ├── index.css            # 全局样式 + 强制配色方案（CSS 变量）
    ├── config/              # 全局配置（API 端点、动画时长、超时等）
    ├── types/               # TypeScript 类型定义（可扩展数据模型）
    ├── db/                  # Dexie IndexedDB 数据层
    ├── utils/               # SVG 图标库、DOMPurify、B站解析、AI、导出等
    ├── hooks/               # useComponents / useDebounce / useToast 等
    ├── components/          # 所有 UI 组件
    └── samples/             # 首次加载的示例组件
```

## 配色方案

所有颜色通过 CSS 变量集中定义于 `src/index.css` 的 `:root`，可整体覆盖：

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--color-bg` | `#0B0B0C` | 应用底色 |
| `--color-surface-1/2/3` | `#151412 / #1F1D1A / #2A2723` | 卡片 / 模态框 / hover 层级 |
| `--color-border` | `#262320` | 暖调发丝级边框 |
| `--color-text-primary` | `#F7F3EA` | 主文字 |
| `--color-accent` | `#E6B450` | 温暖琥珀金强调色 |
| `--color-accent-soft` | `rgba(230,180,80,0.12)` | 强调色 glow / 背景 |
| `--color-success/danger/info` | `#34D399 / #F87171 / #22D3EE` | 功能色 |

## 数据模型（可扩展）

```ts
interface Component {
  id: string;
  name: string;
  url?: string;
  tags: string[];
  html: string;
  css: string;
  js: string;
  createdAt: number;
  updatedAt: number;
}
```

未来可新增 `framework`、`category` 等字段而不破坏现有代码。

## 安全说明

- 所有用户输入的 HTML / CSS 在保存前经 **DOMPurify** 清洗，防止存储型 XSS。
- iframe 渲染使用 `sandbox="allow-scripts"`（srcdoc 同源注入，不开放 same-origin）。
- API Key 仅保存在浏览器 `localStorage`，请求直接 HTTPS 发送到 OpenAI / Anthropic 官方端点，不经过任何第三方服务器。
- 所有外部请求均使用 HTTPS 并设置 10 秒超时，失败时优雅降级。

## 插件钩子

在保存、删除、搜索、导入、导出等操作后派发自定义事件，便于扩展统计或同步功能：

```ts
window.addEventListener('stylehandler:save', (e) => {
  const { detail } = e as CustomEvent;
  console.log('saved', detail.component); // 需要时使用
});
```

支持的事件：`stylehandler:save`、`stylehandler:delete`、`stylehandler:search`、`stylehandler:import`、`stylehandler:export`。

## 许可证

MIT
