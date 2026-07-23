/**
 * 问题详情与定位
 *
 * 实时渲染幻灯片文本预览 + 问题高亮
 * 支持：
 *   - 同页面问题列表，快速切换
 *   - 页面缩略图导航，显示问题数量
 *   - 多种高亮匹配策略
 */
import { store } from '../store.js';
import { renderSlidePreview, renderThumbnail, findHighlightIndex, getHighlightPosition } from '../utils/preview.js';

const PREVIEW_WIDTH = 580;  // px

export function renderIssueDetail(state) {
  const issues = state.issues || [];
  const idx = state.currentIssueIndex >= 0 ? state.currentIssueIndex : 0;
  const issue = issues[idx] || { page: 1, type: '未知', level: 's3', desc: '无数据' };
  const slides = state.slidePreviews || [];
  const presInfo = state.presInfo || { width: 12192000, height: 6858000 };
  const sw = presInfo.width;
  const sh = presInfo.height;
  const scale = PREVIEW_WIDTH / sw;
  const previewH = Math.round(sh * scale) + 2;

  // 当前页幻灯片
  const curSlide = slides.find(s => s.page === issue.page) || { page: issue.page, texts: [], shapes: [] };
  const hlIdx = findHighlightIndex(curSlide, issue);
  const hlPos = hlIdx < 0 ? getHighlightPosition(curSlide, issue) : null;

  // 对齐问题的参考数据
  const refPos = (issue.rule === 'R007' && issue.refPositions) ? issue.refPositions : null;
  const alignLine = (issue.rule === 'R007' && issue.alignDim && issue.alignValue != null)
    ? { dim: issue.alignDim, value: issue.alignValue } : null;

  // 预览 HTML
  const previewHTML = curSlide.texts.length > 0 || curSlide.shapes.length > 0
    ? renderSlidePreview(curSlide, presInfo, PREVIEW_WIDTH, hlIdx, refPos, alignLine, hlPos)
    : `<div style="display:flex;align-items:center;justify-content:center;height:${previewH}px;background:#fafbfc;border:1px solid #cfd7e3;color:var(--muted);font-size:14px">${curSlide.loadError ? '页面加载失败：' + curSlide.loadError : '无内容可预览'}</div>`;

  // === 页面缩略图导航（显示有问题的页面）===
  const issuePages = [...new Set(issues.map(x => x.page))].sort((a, b) => a - b);
  // 限制最多显示 10 个页面缩略图
  const displayPages = issuePages.slice(0, 10);
  const hasMorePages = issuePages.length > 10;

  // === 当前页面所有问题列表（用于快速切换）===
  const curPageIssues = issues
    .map((x, i) => ({ idx: i, ...x }))
    .filter(x => x.page === issue.page);

  const pageLevelOrder = { s1: 0, s2: 1, s3: 2, s4: 3 };
  curPageIssues.sort((a, b) => (pageLevelOrder[a.level] ?? 9) - (pageLevelOrder[b.level] ?? 9));

  const levelLabels = {
    s1: 'S1 严重', s2: 'S2 高风险', s3: 'S3 一般', s4: 'S4 建议',
  };

  return `
    <div class="heading">
      <div>
        <h1>问题详情与定位</h1>
        <div class="muted">页面 ${issue.page} / ${state.pageCount || '-'}　问题 ${idx + 1}/${issues.length}${issue.rule ? '　' + issue.rule : ''}</div>
      </div>
      <div class="toolbar">
        <button class="btn" onclick="showIssue(${idx - 1})" ${idx <= 0 ? 'disabled' : ''}>上一个</button>
        <button class="btn" onclick="showIssue(${idx + 1})" ${idx >= issues.length - 1 ? 'disabled' : ''}>下一个</button>
      </div>
    </div>
    <div class="detail">
      <div class="card slides">
        <div class="thumbs" style="overflow-y:auto">
          ${displayPages.map(pg => {
            const pgIssues = issues.filter(x => x.page === pg);
            const s = slides.find(sl => sl.page === pg);
            const isActive = pg === issue.page;
            // 跳转到该页的第一个问题的索引
            const firstIdx = issues.findIndex(x => x.page === pg);
            const maxLevel = pgIssues.reduce((max, x) => x.level && x.level < max ? x.level : max, 's4');
            const levelColor = { s1: '#e5484d', s2: '#ef7b24', s3: '#e5a11a', s4: '#3c6596' };
            return `
              <div style="margin-bottom:14px;text-align:center;position:relative" onclick="showIssue(${firstIdx})">
                ${renderThumbnail(s || { page: pg, texts: [], shapes: [] }, presInfo, 130, isActive)}
                <small style="display:block;margin-top:4px;color:var(--muted);font-size:11px">
                  第 ${pg} 页
                  <span style="color:${levelColor[maxLevel] || '#647086'};font-weight:700">(${pgIssues.length})</span>
                </small>
              </div>`;
          }).join('')}
          ${hasMorePages ? '<div style="text-align:center;color:var(--muted);font-size:12px">…还有 ' + (issuePages.length - 10) + ' 页</div>' : ''}
          ${issuePages.length === 0 ? '<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px">暂无问题页面</div>' : ''}
        </div>
        <div class="preview" style="overflow:auto;padding:16px">
          <div style="min-height:${previewH + 40}px;display:flex;flex-direction:column;align-items:center">
            ${previewHTML}
            ${hlIdx >= 0
              ? '<div style="margin-top:8px;font-size:12px;color:#e5484d">● 红框标注为问题对象</div>'
              : hlPos
                ? '<div style="margin-top:8px;font-size:12px;color:#ef7b24">● 红虚框为按坐标定位的问题元素区域</div>'
                : '<div style="margin-top:8px;font-size:12px;color:#647086">● 未能在预览中定位到问题元素（可能为非文本对象）</div>'}
            <div class="muted" style="margin-top:12px;font-size:12px">缩放 72%　　－　＋　　　　　　　　　　　　　适应窗口</div>
          </div>
        </div>
      </div>
      <div class="card panel">
        <h2>⚠ ${issue.type}${issue.rule ? '（' + issue.rule + '）' : ''}</h2>
        <span class="badge ${issue.level}">${levelLabels[issue.level] || issue.level.toUpperCase()}</span>
        <div class="field"><b>页面</b>${issue.page} <span style="color:var(--muted);font-size:12px">（本页共 ${curPageIssues.length} 个问题）</span></div>
        <div class="field"><b>实际值</b>${issue.actual || '-'}</div>
        <div class="field"><b>标准值</b>${issue.expected || '-'}</div>
        <div class="field"><b>标准来源</b>${issue.source || '-'}</div>
        <div class="field"><b>判断依据</b>${issue.reason || '-'}</div>
        <div class="field"><b>修改建议</b>${issue.suggestion || '-'}</div>
        <div class="field"><b>可自动修复</b>${issue.fixable ? '是' : '否'}</div>

        <!-- 当前页面的全部问题列表（快速切换） -->
        ${curPageIssues.length > 1 ? `
        <div class="field" style="border-bottom:none;padding-bottom:4px">
          <b>本页全部问题</b>
        </div>
        <div style="margin:0 0 12px 0;border:1px solid #edf0f4;border-radius:8px;overflow:hidden">
          ${curPageIssues.map(pi => `
            <div onclick="showIssue(${pi.idx})" style="display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f2f6;${pi.idx === idx ? 'background:#edf3ff;' : ''}transition:background 0.15s"
                 onmouseover="this.style.background='#f5f7fc'" onmouseout="this.style.background='${pi.idx === idx ? '#edf3ff' : 'transparent'}'">
              <span class="badge ${pi.level}" style="font-size:10px;height:20px;padding:0 7px;flex-shrink:0">${levelLabels[pi.level]}</span>
              <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${pi.idx === idx ? 'var(--blue)' : '#172033'}">${pi.desc}</span>
              ${pi.fixable ? '<span style="color:var(--green);font-size:11px">可修复</span>' : ''}
              <span style="color:var(--muted);font-size:11px">${pi.rule || ''}</span>
            </div>
          `).join('')}
        </div>` : ''}

        <div class="field" style="cursor:pointer" id="techInfoToggle"><b>▸ 技术信息</b></div>
        <div id="techInfoContent" style="display:none;padding:8px 0">
          <div class="field"><b>对象类型</b>${issue.object || '-'}</div>
          <div class="field"><b>处理状态</b>${issue.status || '待处理'}</div>
          ${issue.sensitiveWord ? '<div class="field"><b>命中词条</b>' + issue.sensitiveWord + '</div>' : ''}
          ${issue.charRange ? '<div class="field"><b>字符范围</b>第 ' + issue.charRange[0] + '-' + issue.charRange[1] + ' 字符</div>' : ''}
          ${issue.fixData?.shapeId ? '<div class="field"><b>对象 ID</b>' + issue.fixData.shapeId + '</div>' : ''}
        </div>

        <!-- 导航：上一页 / 下一页 同页问题 -->
        <div style="display:flex;justify-content:space-between;gap:8px;margin-top:16px;padding:0 0 12px 0;border-bottom:1px solid #edf0f4">
          ${(() => {
            const prevOnPage = curPageIssues.filter(x => x.idx < idx);
            const nextOnPage = curPageIssues.filter(x => x.idx > idx);
            const prevOne = prevOnPage[prevOnPage.length - 1];
            const nextOne = nextOnPage[0];
            return `
              <button class="btn" onclick="showIssue(${prevOne ? prevOne.idx : idx})" style="font-size:12px;flex:1" ${prevOne ? '' : 'disabled'}>↑ 本页上一个</button>
              <button class="btn" onclick="showIssue(${nextOne ? nextOne.idx : idx})" style="font-size:12px;flex:1" ${nextOne ? '' : 'disabled'}>↓ 本页下一个</button>
            `;
          })()}
        </div>

        <div class="footer">
          <button class="btn" id="ignoreIssueBtn" data-idx="${idx}">${issue.status === '已忽略' ? '取消忽略' : '忽略'}</button>
          ${issue.fixable && !state.scanCancelled ? '<button class="btn primary" onclick="toggleFixIssue()">修复此问题</button>' : '<button class="btn" disabled>需手动处理</button>'}
        </div>
      </div>
    </div>
  `;
}

window.showIssue = function(idx) {
  store.set('currentIssueIndex', idx);
  location.hash = 'issue-detail';
};

window.toggleFixIssue = function() {
  const idx = store.get('currentIssueIndex');
  if (idx < 0) return;
  const sel = new Set(store.get('selectedIssues') || []);
  sel.add(idx);
  store.set('selectedIssues', sel);
  location.hash = 'fix-confirm';
};

export function afterRenderIssueDetail() {
  // 忽略/取消忽略按钮
  const ignoreBtn = document.getElementById('ignoreIssueBtn');
  if (ignoreBtn) {
    ignoreBtn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.idx);
      const issues = store.get('issues') || [];
      if (idx < 0 || idx >= issues.length) return;
      const issue = issues[idx];
      const newStatus = issue.status === '已忽略' ? '待处理' : '已忽略';
      const updated = issues.map((x, i) => i === idx ? { ...x, status: newStatus } : x);
      store.set('issues', updated);
      location.hash = 'issue-detail';
    });
  }

  // 技术信息折叠
  const toggle = document.getElementById('techInfoToggle');
  const content = document.getElementById('techInfoContent');
  if (toggle && content) {
    toggle.addEventListener('click', function() {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      this.innerHTML = isHidden ? '▾ 技术信息' : '▸ 技术信息';
    });
  }
}
