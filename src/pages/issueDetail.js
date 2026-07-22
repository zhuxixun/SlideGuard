/**
 * 问题详情与定位
 *
 * 实时渲染幻灯片文本预览 + 问题高亮
 */
import { store } from '../store.js';
import { renderSlidePreview, renderThumbnail, findHighlightIndex } from '../utils/preview.js';

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

  // 对齐问题的参考数据
  const refPos = (issue.rule === 'R007' && issue.refPositions) ? issue.refPositions : null;
  const alignLine = (issue.rule === 'R007' && issue.alignDim && issue.alignValue != null)
    ? { dim: issue.alignDim, value: issue.alignValue } : null;

  // 预览 HTML
  const previewHTML = curSlide.texts.length > 0 || curSlide.shapes.length > 0
    ? renderSlidePreview(curSlide, presInfo, PREVIEW_WIDTH, hlIdx, refPos, alignLine)
    : `<div style="display:flex;align-items:center;justify-content:center;height:${previewH}px;background:#fafbfc;border:1px solid #cfd7e3;color:var(--muted);font-size:14px">${curSlide.loadError ? '页面加载失败：' + curSlide.loadError : '无内容可预览'}</div>`;

  // 缩略图：显示当前页前后不同页面
  const seenPages = new Set();
  const thumbSlides = [];
  for (let offset = -2; offset <= 2; offset++) {
    const pi = idx + offset;
    if (pi >= 0 && pi < issues.length) {
      const pg = issues[pi].page;
      if (!seenPages.has(pg)) {
        seenPages.add(pg);
        const s = slides.find(sl => sl.page === pg);
        thumbSlides.push({ issueIdx: pi, page: pg, slide: s || { page: pg, texts: [], shapes: [] }, isActive: pi === idx });
      }
    }
  }

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
          ${thumbSlides.map(ts => `
            <div style="margin-bottom:14px;text-align:center" onclick="showIssue(${ts.issueIdx})">
              ${renderThumbnail(ts.slide, presInfo, 130, ts.isActive)}
              <small style="display:block;margin-top:4px;color:var(--muted);font-size:11px">第 ${ts.page} 页</small>
            </div>
          `).join('')}
        </div>
        <div class="preview" style="overflow:auto;padding:16px">
          <div style="min-height:${previewH + 40}px;display:flex;flex-direction:column;align-items:center">
            ${previewHTML}
            ${hlIdx >= 0 ? '<div style="margin-top:8px;font-size:12px;color:var(--muted)">红框标注为问题对象</div>' : ''}
            <div class="muted" style="margin-top:12px;font-size:12px">缩放 72%　　－　＋　　　　　　　　　　　　　适应窗口</div>
          </div>
        </div>
      </div>
      <div class="card panel">
        <h2>⚠ ${issue.type}${issue.rule ? '（' + issue.rule + '）' : ''}</h2>
        <span class="badge ${issue.level}">${ {s1:'S1 严重', s2:'S2 高风险', s3:'S3 一般', s4:'S4 建议'}[issue.level] || issue.level.toUpperCase() }</span>
        <div class="field"><b>页面</b>${issue.page}</div>
        <div class="field"><b>实际值</b>${issue.actual || '-'}</div>
        <div class="field"><b>标准值</b>${issue.expected || '-'}</div>
        <div class="field"><b>标准来源</b>${issue.source || '-'}</div>
        <div class="field"><b>判断依据</b>${issue.reason || '-'}</div>
        <div class="field"><b>修改建议</b>${issue.suggestion || '-'}</div>
        <div class="field"><b>可自动修复</b>${issue.fixable ? '是' : '否'}</div>
        <div class="field" style="cursor:pointer" id="techInfoToggle"><b>▸ 技术信息</b></div>
        <div id="techInfoContent" style="display:none;padding:8px 0">
          <div class="field"><b>对象类型</b>${issue.object || '-'}</div>
          <div class="field"><b>处理状态</b>${issue.status || '待处理'}</div>
          ${issue.sensitiveWord ? '<div class="field"><b>命中词条</b>' + issue.sensitiveWord + '</div>' : ''}
          ${issue.charRange ? '<div class="field"><b>字符范围</b>第 ' + issue.charRange[0] + '-' + issue.charRange[1] + ' 字符</div>' : ''}
          ${issue.fixData?.shapeId ? '<div class="field"><b>对象 ID</b>' + issue.fixData.shapeId + '</div>' : ''}
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
