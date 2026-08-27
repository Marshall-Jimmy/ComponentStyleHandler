import type { Component } from '../types';

/**
 * 预设示例组件
 * 首次加载且数据库中无数据时自动注入。
 */

export const SAMPLE_COMPONENTS: Omit<Component, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '琥珀渐变按钮',
    url: 'https://example.com/button',
    tags: ['按钮', '渐变', 'hover'],
    html: `<button class="btn">
  <span class="btn-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  </span>
  <span>添加组件</span>
</button>`,
    css: `* { box-sizing: border-box; margin: 0; }
body { min-height: 100vh; display: grid; place-items: center; background: #0B0B0C; font-family: system-ui, sans-serif; }
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px; border: none; border-radius: 12px;
  background: linear-gradient(135deg, #E6B450, #F0C36A);
  color: #0B0B0C; font-size: 15px; font-weight: 600;
  cursor: pointer; box-shadow: 0 4px 20px rgba(230,180,80,0.35);
  transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s;
}
.btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(230,180,80,0.5); }
.btn:active { transform: translateY(0) scale(0.97); }
.btn-icon { display: grid; place-items: center; }`,
    js: `document.querySelector('.btn').addEventListener('click', () => {
  const btn = document.querySelector('.btn');
  btn.textContent = '已添加';
  btn.style.opacity = '0.8';
  setTimeout(() => { btn.textContent = '添加组件'; btn.style.opacity = '1'; }, 1200);
});`,
  },
  {
    name: '琥珀开关',
    url: 'https://example.com/switch',
    tags: ['开关', '交互'],
    html: `<div class="switch-wrap">
  <label class="switch" for="toggle">
    <input type="checkbox" id="toggle" />
    <span class="track"><span class="thumb"></span></span>
  </label>
  <span class="status" id="status">已关闭</span>
</div>`,
    css: `* { box-sizing: border-box; margin: 0; }
body { min-height: 100vh; display: grid; place-items: center; background: #0B0B0C; font-family: system-ui, sans-serif; }
.switch-wrap { display: flex; align-items: center; gap: 14px; }
.switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.track {
  display: block; width: 56px; height: 30px; border-radius: 999px;
  background: #2A2723; border: 1px solid #3A3631; cursor: pointer;
  transition: background 0.3s cubic-bezier(0.4,0,0.2,1);
}
.thumb {
  display: block; width: 24px; height: 24px; border-radius: 50%;
  background: #A8A29A; margin: 2px; transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), background 0.3s;
}
.switch input:checked + .track { background: rgba(230,180,80,0.25); border-color: #E6B450; }
.switch input:checked + .track .thumb { transform: translateX(26px); background: #E6B450; box-shadow: 0 0 12px rgba(230,180,80,0.6); }
.switch input:focus-visible + .track { outline: 2px solid #E6B450; outline-offset: 2px; }
.status { color: #A8A29A; font-size: 14px; }`,
    js: `const input = document.getElementById('toggle');
const status = document.getElementById('status');
input.addEventListener('change', () => {
  status.textContent = input.checked ? '已开启' : '已关闭';
});`,
  },
];
