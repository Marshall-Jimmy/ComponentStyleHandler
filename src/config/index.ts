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
  /** Toast 退场动画时长（ms） */
  toastExitDuration: 240,
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
  /** 热评 API（旧版 x/v2/reply 免 WBI 签名，风控更宽松） */
  replyApi: 'https://api.bilibili.com/x/v2/reply',
  /** 热评数量（分页拉取，含子回复，适当放宽以覆盖更多隐藏链接） */
  replyCount: 60,
  /** 同源反向代理前缀（Vite dev/preview 已配置 /bili-api → api.bilibili.com，无 CORS 限制） */
  proxyPrefix: '/bili-api',
};

/** CORS 代理链（备选降级，按序尝试） */
export const CORS_PROXIES = [
  'https://corsproxy.io/?url=',
  'https://corsproxy.org/?',
  'https://cors.eu.org/',
];

export const CODEPEN = {
  /** CodePen 解析 API（备选） */
  api: 'https://cpv2api.com/pens/',
};

export const GITHUB = {
  /** Gist API */
  gistApi: 'https://api.github.com/gists/',
  /** raw 文件主机 */
  rawHost: 'https://raw.githubusercontent.com',
  /** Gist raw 主机 */
  gistRawHost: 'https://gist.githubusercontent.com',
  /** 镜像前缀：直连失败时拼接该前缀使用 gh-proxy.com 镜像 */
  mirrorPrefix: 'https://gh-proxy.com/',
};

export const GITEE = {
  /** Gitee API v5 基础地址 */
  api: 'https://gitee.com/api/v5',
  /** 同源反向代理前缀（Vite dev/preview 已配置 /gitee-api → gitee.com，无 CORS 限制） */
  proxyPrefix: '/gitee-api',
};

export const GITLAB = {
  /** GitLab 官方 API v4 基础地址（自托管实例按 host 动态计算） */
  api: 'https://gitlab.com/api/v4',
  /** 同源反向代理前缀（Vite dev/preview 已配置 /gitlab-api → gitlab.com，无 CORS 限制） */
  proxyPrefix: '/gitlab-api',
};

export const AI = {
  openaiEndpoint: 'https://api.openai.com/v1/chat/completions',
  openaiModel: 'gpt-4o-mini',
  claudeEndpoint: 'https://api.anthropic.com/v1/messages',
  claudeModel: 'claude-3-5-sonnet-20241022',
  /** localStorage 中保存 API Key 的键名 */
  storageKey: 'stylehandler:ai-keys',
};

/** 网盘域名识别列表（须与 utils/netdisk.ts 的 detectNetdisk 保持一致，新增平台两端同步） */
export const NETDISK_HOSTS = [
  'pan.baidu.com',
  'aliyundrive.com',
  'alipan.com',
  'quark.cn',
  'lanzou',
  'lanzn',
  'lanzouo',
  '123pan.com',
  '123684.com',
  '123912.com',
  'cowtransfer.com',
  'weiyun.com',
  'pan.xunlei.com',
  'cloud.189.cn',
  'yun.139.com',
  'feijipan.com',
  'feijix.com',
  'uc.cn',
  'ctfile.com',
  'ctdisk.com',
  'wenshushu.cn',
  'wen.lu',
  'fangcloud.com',
  'ysepan.com',
];

/** 代码托管站点识别列表 */
export const CODE_HOSTS = [
  'codepen.io',
  'jsfiddle.net',
  'github.com',
  'gist.github.com',
  'stackblitz.com',
  'codesandbox.io',
  'gitee.com',
  'gitlab.com',
];

/** 网盘直链解析端点 */
export const NETDISK = {
  /** NFD 第三方聚合解析服务（支持蓝奏/123/夸克/奶牛/移动云/小飞机等，CORS 已开启） */
  qaiuParserApi: 'https://lz.qaiu.top/json/parser',
  /** NFD 解析服务备用镜像 */
  qaiuParserApiAlt: 'https://lz0.qaiu.top/json/parser',
  /** NFD 文件夹文件列表 API */
  qaiuFileListApi: 'https://lz.qaiu.top/v2/getFileList',
  /** NFD 文件夹文件列表 API 备用镜像 */
  qaiuFileListApiAlt: 'https://lz0.qaiu.top/v2/getFileList',
  /** 阿里云盘匿名分享信息 API（浏览器端受 CORS 限制，仅作 best-effort） */
  aliyunShareInfoApi: 'https://api.aliyundrive.com/adrive/v1.0/shareLink/getShareInfoByAnonymous',
  /** 阿里云盘匿名分享令牌 API */
  aliyunShareTokenApi: 'https://api.aliyundrive.com/adrive/v1.0/shareLink/getShareTokenByAnonymous',
  /** 阿里云盘匿名文件列表 API */
  aliyunShareFileApi: 'https://api.aliyundrive.com/adrive/v1.0/shareLink/getShareFileByAnonymous',
  /** 阿里云盘匿名下载链接 API */
  aliyunDownloadApi: 'https://api.aliyundrive.com/adrive/v1.0/shareLink/getShareLinkDownloadUrl',
};
