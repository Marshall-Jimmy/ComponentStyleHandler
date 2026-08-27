/**
 * 全局配置中心
 * 所有可调参数（颜色、API 端点、动画时长、超时等）集中于此，便于后期修改。
 */

export const APP_NAME = 'StyleHandler';

export const ANIMATION = {
  /** 所有交互动画的最大时长（ms） */
  duration: 400,
  /** 统一缓动函数 */
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** 卡片入场动画 */
  cardEntry: 400,
  /** Toast 显示时长（ms） */
  toastDuration: 2400,
};

export const TIMEOUT = {
  /** 外部请求超时（ms） */
  request: 10000,
  /** 搜索防抖（ms） */
  searchDebounce: 300,
  /** 窗口 resize 节流（ms） */
  resizeThrottle: 200,
};

export const GRID = {
  /** 卡片墙每列最小宽度（px） */
  minColumnWidth: 280,
};

export const BILIBILI = {
  /** 视频信息 API */
  viewApi: 'https://api.bilibili.com/x/web-interface/view',
  /** 热评 API */
  replyApi: 'https://api.bilibili.com/x/v2/reply/main',
  /** 热评数量 */
  replyCount: 20,
  /** CORS 代理（备选） */
  corsProxy: 'https://corsproxy.io/?url=',
};

export const CODEPEN = {
  /** CodePen 解析 API（备选） */
  api: 'https://cpv2api.com/pens/',
};

export const GITHUB = {
  /** Gist API */
  gistApi: 'https://api.github.com/gists/',
};

export const AI = {
  openaiEndpoint: 'https://api.openai.com/v1/chat/completions',
  openaiModel: 'gpt-4o-mini',
  claudeEndpoint: 'https://api.anthropic.com/v1/messages',
  claudeModel: 'claude-3-5-sonnet-20241022',
  /** localStorage 中保存 API Key 的键名 */
  storageKey: 'stylehandler:ai-keys',
};

/** 网盘域名识别列表 */
export const NETDISK_HOSTS = [
  'pan.baidu.com',
  'aliyundrive.com',
  'alipan.com',
  'quark.cn',
  'lanzou',
  'lanzn',
  'lanzouo',
  '123pan.com',
  'cowtransfer.com',
  'weiyun.com',
  'pan.xunlei.com',
];

/** 代码托管站点识别列表 */
export const CODE_HOSTS = [
  'codepen.io',
  'jsfiddle.net',
  'github.com',
  'gist.github.com',
  'stackblitz.com',
  'codesandbox.io',
];
