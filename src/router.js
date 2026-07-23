/**
 * SlideGuard Hash 路由
 */
import { store } from './store.js';
import { renderHome, afterRenderHome } from './pages/home.js';
import { renderScanSettings, afterRenderScanSettings } from './pages/scanSettings.js';
import { renderSensitiveWords, afterRenderSensitiveWords } from './pages/sensitiveWords.js';
import { renderScanning, afterRenderScanning } from './pages/scanning.js';
import { renderScanResult } from './pages/scanResult.js';
import { renderIssueList, afterRenderIssueList } from './pages/issueList.js';
import { renderIssueDetail, afterRenderIssueDetail } from './pages/issueDetail.js';
import { renderFixConfirm, afterRenderFixConfirm } from './pages/fixConfirm.js';
import { renderFixResult } from './pages/fixResult.js';
import { renderSidebar } from './components/sidebar.js';

const routes = {
  'home':           { page: '首页',       render: renderHome, afterRender: afterRenderHome },
  'scan-settings':  { page: '扫描设置',   render: renderScanSettings, afterRender: afterRenderScanSettings },
  'sensitive-words':{ page: '敏感词库',   render: renderSensitiveWords, afterRender: afterRenderSensitiveWords },
  'scanning':       { page: '扫描结果',   render: renderScanning, afterRender: afterRenderScanning },
  'scan-result':    { page: '扫描结果',   render: renderScanResult },
  'issue-list':     { page: '问题列表',   render: renderIssueList, afterRender: afterRenderIssueList },
  'issue-detail':   { page: '问题详情',   render: renderIssueDetail, afterRender: afterRenderIssueDetail },
  'fix-confirm':    { page: '修复',       render: renderFixConfirm, afterRender: afterRenderFixConfirm },
  'fix-result':     { page: '修复结果',   render: renderFixResult },
};

const emptyRoutes = {
  'scan-result':  { page: '扫描结果' },
  'issue-list':   { page: '问题列表' },
  'issue-detail': { page: '问题详情' },
  'fix-confirm':  { page: '修复' },
  'fix-result':   { page: '修复结果' },
};

function getRoute() {
  return location.hash.slice(1) || 'home';
}

function renderEmptyState(pageName) {
  const msgs = {
    '扫描结果': '请先完成一次标准检查，之后才能查看扫描结果。',
    '问题列表': '请先完成一次标准检查，之后才能查看问题列表。',
    '问题详情': '请先完成一次标准检查，之后才能查看问题详情。',
    '修复':     '请先完成一次标准检查，之后才能使用修复功能。',
    '修复结果': '请先完成一次标准检查，之后才能使用修复功能。',
  };
  document.getElementById('app').innerHTML =
    `<div class="app"><div class="body">${renderSidebar(pageName)}<main class="main"><div class="heading"><div><h1>${pageName}</h1><div class="muted">${pageName === '扫描结果' ? '查看文件检查结果' : pageName === '问题详情' ? '查看问题详细信息' : pageName === '问题列表' ? '查看问题列表' : ''}</div></div></div><div class="card empty-state"><div><div class="empty-icon">◇</div><h2>暂无可用的扫描结果</h2><p>${msgs[pageName] || '请先完成一次标准检查。'}</p><button class="btn primary" style="margin-top:24px" onclick="location.hash='scan-settings'">前往扫描设置</button></div></div></main></div></div>`;
}

export function navigate(hash) {
  location.hash = hash;
}

export function initRouter() {
  function resolve() {
    const route = getRoute();
    const hasResult = store.get('hasScanResult');

    if (!hasResult && emptyRoutes[route]) {
      renderEmptyState(emptyRoutes[route].page);
      return;
    }

    const match = routes[route];
    if (!match) { location.hash = 'home'; return; }

    const app = document.getElementById('app');
    const state = store.get();
    const content = match.render(state);
    app.innerHTML = `<div class="app"><div class="body">${renderSidebar(match.page)}<main class="main">${content}</main></div></div>`;

    // 调用页面 afterRender hook（用于绑定事件监听器）
    if (match.afterRender) {
      setTimeout(() => match.afterRender(state), 0);
    }
  }

  window.addEventListener('hashchange', resolve);
  resolve();
}
