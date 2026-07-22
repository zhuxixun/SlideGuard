/**
 * 问题列表 — 筛选、勾选、忽略
 */
import { store } from '../store.js';

let _filterState = { search: '', page: '', type: '', level: '', fixable: '', status: '' };

export function renderIssueList(state) {
  const issues = state.issues || [];
  const selected = state.selectedIssues || new Set();
  const filtered = applyFilters(issues, _filterState);

  return `
    <div class="heading">
      <div>
        <h1>问题列表</h1>
        <div class="muted">共 ${issues.length} 个问题，当前筛选 ${filtered.length} 个</div>
      </div>
      <div class="toolbar">
        <button class="btn" onclick="location.hash='scan-result'">返回概览</button>
      </div>
    </div>
    <div class="grid filters">
      <div class="input" style="display:flex;align-items:center;gap:6px;padding:0 12px">
        <span>🔍</span>
        <input type="text" id="ilSearch" placeholder="搜索问题描述" style="border:none;outline:none;flex:1;font-family:inherit;font-size:14px;background:transparent">
      </div>
      <select class="input" id="ilFilterPage" style="appearance:none;cursor:pointer"><option value="">全部页面</option>${uniqPages(issues).map(p => `<option value="${p}">第${p}页</option>`).join('')}</select>
      <select class="input" id="ilFilterType" style="appearance:none;cursor:pointer"><option value="">全部类型</option>${uniqTypes(issues).map(t => `<option value="${t}">${t}</option>`).join('')}</select>
      <select class="input" id="ilFilterLevel" style="appearance:none;cursor:pointer"><option value="">全部级别</option><option value="s1">S1 严重</option><option value="s2">S2 高风险</option><option value="s3">S3 一般</option><option value="s4">S4 建议</option></select>
      <select class="input" id="ilFilterFixable" style="appearance:none;cursor:pointer"><option value="">全部修复性</option><option value="yes">可自动修复</option><option value="no">不可修复</option></select>
      <select class="input" id="ilFilterStatus" style="appearance:none;cursor:pointer"><option value="">全部状态</option><option value="待处理">待处理</option><option value="已忽略">已忽略</option></select>
    </div>
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th style="width:50px"><input type="checkbox" id="ilSelectAll" ${filtered.length > 0 && filtered.every((_, i) => selected.has(issues.indexOf(_))) ? 'checked' : ''}></th>
            <th style="width:70px">页面</th>
            <th>问题类型</th>
            <th style="width:100px">严重级别</th>
            <th>问题描述</th>
            <th style="width:110px">可自动修复</th>
            <th style="width:90px">处理状态</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:40px">暂无匹配的问题</td></tr>' :
            filtered.map((x, fi) => {
              const origIdx = issues.indexOf(x);
              const isSel = selected.has(origIdx);
              return `<tr style="cursor:pointer" onclick="window._ilClick(${origIdx})">
                <td><input type="checkbox" class="il-checkbox" data-idx="${origIdx}" ${isSel ? 'checked' : ''} onclick="event.stopPropagation();window._ilToggle(${origIdx})"></td>
                <td>${x.page}</td>
                <td>${x.type}${x.rule ? ' (' + x.rule + ')' : ''}</td>
                <td><span class="badge ${x.level}">${x.level.toUpperCase()}</span></td>
                <td style="${x.status === '已忽略' ? 'text-decoration:line-through;color:var(--muted)' : ''}">${x.desc}</td>
                <td>${x.fixable ? '是' : '否'}</td>
                <td>${x.status || '待处理'}</td>
              </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>
    ${issues.length > 0 ? `
    <div class="selectedbar" id="ilSelectedBar">
      已选择 <span id="ilSelectedCount">${[...selected].filter(i => i < issues.length).length}</span> 项
      <button class="btn" id="ilIgnoreBtn">忽略</button>
      <button class="btn primary" id="ilFixBtn" ${[...selected].filter(i => i < issues.length).length === 0 ? 'disabled' : ''} onclick="location.hash='fix-confirm'">修复选中项</button>
    </div>` : ''}
  `;
}

function uniqPages(issues) {
  return [...new Set(issues.map(i => i.page).filter(Boolean))].sort((a, b) => a - b);
}
function uniqTypes(issues) {
  return [...new Set(issues.map(i => i.type).filter(Boolean))];
}

function applyFilters(issues, f) {
  return issues.filter((x, i) => {
    if (f.search && !x.desc.toLowerCase().includes(f.search.toLowerCase())) return false;
    if (f.page && String(x.page) !== f.page) return false;
    if (f.type && x.type !== f.type) return false;
    if (f.level && x.level !== f.level) return false;
    if (f.fixable === 'yes' && !x.fixable) return false;
    if (f.fixable === 'no' && x.fixable) return false;
    if (f.status && (x.status || '待处理') !== f.status) return false;
    return true;
  });
}

/* ── 页面交互 ── */

window._ilToggle = function(idx) {
  const sel = new Set(store.get('selectedIssues') || []);
  if (sel.has(idx)) sel.delete(idx); else sel.add(idx);
  store.set('selectedIssues', sel);
  updateSelectedBar();
};

window._ilClick = function(idx) {
  store.set('currentIssueIndex', idx);
  location.hash = 'issue-detail';
};

window._ilSelectAll = function() {
  const issues = store.get('issues') || [];
  const filtered = applyFilters(issues, _filterState);
  const sel = new Set(store.get('selectedIssues') || []);
  const allSelected = filtered.length > 0 && filtered.every((_, fi) => sel.has(issues.indexOf(filtered[fi])));
  if (allSelected) {
    // 取消全选
    filtered.forEach(x => sel.delete(issues.indexOf(x)));
  } else {
    // 全选
    filtered.forEach(x => sel.add(issues.indexOf(x)));
  }
  store.set('selectedIssues', sel);
  updateSelectedBar();
  // 更新 checkbox 状态
  document.querySelectorAll('.il-checkbox').forEach(cb => {
    const idx = parseInt(cb.dataset.idx);
    cb.checked = sel.has(idx);
  });
};

window._ilIgnore = function() {
  const issues = store.get('issues') || [];
  const sel = store.get('selectedIssues') || new Set();
  // 将选中项标记为已忽略
  const updated = issues.map((x, i) => {
    if (sel.has(i)) return { ...x, status: '已忽略' };
    return x;
  });
  store.set('issues', updated);
  store.set('selectedIssues', new Set());
  refreshIssueList();
};

function updateSelectedBar() {
  const issues = store.get('issues') || [];
  const sel = store.get('selectedIssues') || new Set();
  const count = [...sel].filter(i => i < issues.length).length;
  const countEl = document.getElementById('ilSelectedCount');
  const fixBtn = document.getElementById('ilFixBtn');
  const ignoreBtn = document.getElementById('ilIgnoreBtn');
  if (countEl) countEl.textContent = count;
  if (fixBtn) fixBtn.disabled = count === 0;
}

function refreshIssueList() {
  const issues = store.get('issues') || [];
  const selected = store.get('selectedIssues') || new Set();
  const filtered = applyFilters(issues, _filterState);

  // 更新标题副文本
  const headingMuted = document.querySelector('.heading .muted');
  if (headingMuted) headingMuted.textContent = '共 ' + issues.length + ' 个问题，当前筛选 ' + filtered.length + ' 个';

  // 更新表格体
  const tbody = document.querySelector('.table tbody');
  if (tbody) {
    tbody.innerHTML = filtered.length === 0
      ? '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:40px">暂无匹配的问题</td></tr>'
      : filtered.map((x, fi) => {
          const origIdx = issues.indexOf(x);
          const isSel = selected.has(origIdx);
          return `<tr style="cursor:pointer" onclick="window._ilClick(${origIdx})">
            <td><input type="checkbox" class="il-checkbox" data-idx="${origIdx}" ${isSel ? 'checked' : ''} onclick="event.stopPropagation();window._ilToggle(${origIdx})"></td>
            <td>${x.page}</td>
            <td>${x.type}${x.rule ? ' (' + x.rule + ')' : ''}</td>
            <td><span class="badge ${x.level}">${x.level.toUpperCase()}</span></td>
            <td style="${x.status === '已忽略' ? 'text-decoration:line-through;color:var(--muted)' : ''}">${x.desc}</td>
            <td>${x.fixable ? '是' : '否'}</td>
            <td>${x.status || '待处理'}</td>
          </tr>`;
        }).join('');
  }

  // 更新全选复选框
  const selectAll = document.getElementById('ilSelectAll');
  if (selectAll) {
    selectAll.checked = filtered.length > 0 && filtered.every((_, fi) => selected.has(issues.indexOf(filtered[fi])));
  }

  updateSelectedBar();
}

/* ── afterRender ── */

export function afterRenderIssueList() {
  _filterState = { search: '', page: '', type: '', level: '', fixable: '', status: '' };

  // 搜索
  const searchInput = document.getElementById('ilSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      _filterState.search = searchInput.value;
      refreshIssueList();
    });
  }

  // 下拉筛选
  ['ilFilterPage', 'ilFilterType', 'ilFilterLevel', 'ilFilterFixable', 'ilFilterStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const key = id.replace('ilFilter', '').toLowerCase();
      const map = { page: 'page', type: 'type', level: 'level', fixable: 'fixable', status: 'status' };
      _filterState[map[key]] = el.value;
      refreshIssueList();
    });
  });

  // 全选
  const selectAll = document.getElementById('ilSelectAll');
  if (selectAll) {
    selectAll.addEventListener('change', () => window._ilSelectAll());
  }

  // 忽略
  const ignoreBtn = document.getElementById('ilIgnoreBtn');
  if (ignoreBtn) {
    ignoreBtn.addEventListener('click', () => window._ilIgnore());
  }

  // 更新选中栏
  updateSelectedBar();
}
