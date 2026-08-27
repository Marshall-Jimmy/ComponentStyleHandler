import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          dexie: ['dexie'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/bili-api': {
        target: 'https://api.bilibili.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bili-api/, ''),
        configure: (proxy) => {
          // B 站评论接口有防盗链（按 Referer/Origin 校验），转发时伪装为本站请求
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('referer', 'https://www.bilibili.com/');
            proxyReq.removeHeader('origin');
          });
        },
      },
      // Gitee API 同源代理：浏览器直连 gitee.com 可能被 CORS 拦截
      '/gitee-api': {
        target: 'https://gitee.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gitee-api/, ''),
      },
      // GitLab API 同源代理：gitlab.com 直连可能被 CORS 拦截
      '/gitlab-api': {
        target: 'https://gitlab.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gitlab-api/, ''),
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/bili-api': {
        target: 'https://api.bilibili.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bili-api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('referer', 'https://www.bilibili.com/');
            proxyReq.removeHeader('origin');
          });
        },
      },
      '/gitee-api': {
        target: 'https://gitee.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gitee-api/, ''),
      },
      '/gitlab-api': {
        target: 'https://gitlab.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gitlab-api/, ''),
      },
    },
  },
});
