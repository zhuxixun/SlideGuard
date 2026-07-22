/**
 * 侧边栏组件
 */
export function renderSidebar(active) {
  const items = ['首页', '扫描设置', '敏感词库', '扫描结果', '问题详情', '修复', '修复结果'];
  const routes = {
    '首页': 'home',
    '扫描设置': 'scan-settings',
    '敏感词库': 'sensitive-words',
    '扫描结果': 'scan-result',
    '问题详情': 'issue-detail',
    '修复': 'fix-confirm',
    '修复结果': 'fix-result',
  };

  return `<aside class="side">
    <div class="logo"><span>◆</span> SlideGuard</div>
    <div class="nav">
      ${items.map(x => `<div class="${x === active ? 'active' : ''}" onclick="location.hash='${routes[x]}'">${x}</div>`).join('')}
    </div>
    <div class="privacy">
      <b>● 离线运行</b>
      文件仅在本机处理，<br>不会上传或访问互联网
    </div>
  </aside>`;
}
