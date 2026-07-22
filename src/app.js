/**
 * SlideGuard - 入口
 * 纯浏览器端 PowerPoint 质量与合规检查工具
 */
import { initRouter } from './router.js';
import { store } from './store.js';

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
});
