/**
 * 问题详情与定位
 *
 * 按新版详情页设计组织页面缩略图、结构化预览和问题说明，同时保留
 * 问题切换、忽略及进入自动修复流程的能力。
 */
import { store } from '../store.js';
import { renderSlidePreview, renderThumbnail, findHighlightIndex, getHighlightPosition } from '../utils/preview.js';

const PREVIEW_WIDTH = 720;

function objectLabel(issue) {
  return issue.object || issue.fixData?.objectType || (issue.rule === 'R009' ? '正文文本框' : '页面对象');
}

function renderDetailContent(issue, located) {
  if (!located) {
    return `
      <div class="state-banner unlocated"><b>无法在预览中定位</b><span>检测结论仍可查看，但必须回到原始 PowerPoint 核实页面内容。</span></div>
      <div class="detail-section"><h3>发生了什么</h3><p>${issue.reason || '当前预览引擎无法完整解析该对象，因此不能可靠标出具体问题位置。'}</p></div>
      <div class="detail-section advice"><h3>下一步怎么做</h3><p>${issue.suggestion || `在 PowerPoint 中打开第 ${issue.page} 页，核实对应内容后再决定是否忽略本条提示。`}</p></div>`;
  }

  if (!issue.fixable) {
    const range = issue.charRange ? `第 ${issue.charRange[0]}–${issue.charRange[1]} 个字符` : '请结合上下文核实';
    return `
      <div class="state-banner manual"><b>需要人工核实</b><span>涉及文本语义或复杂版面，SlideGuard 不会自动修改。</span></div>
      ${issue.sensitiveWord ? `<div class="hit-word"><span>命中词条</span><strong>“${issue.sensitiveWord}”</strong><small>${range}</small></div>` : ''}
      <div class="detail-section"><h3>为什么这样判断</h3><p>${issue.reason || '该问题需要结合原始页面内容和使用场景进行人工判断。'}</p></div>
      <div class="detail-section advice manual-advice"><h3>建议如何处理</h3><p>${issue.suggestion || '请在 PowerPoint 中核实并手动调整对应内容。'}</p></div>`;
  }

  return `
    <div class="state-banner auto"><b>可安全自动修复</b><span>仅调整检测到的对象属性，不改变其他页面内容。</span></div>
    <div class="value-compare"><div><span>实际值</span><strong>${issue.actual || '-'}</strong></div><b>→</b><div><span>建议值</span><strong>${issue.expected || '-'}</strong></div></div>
    <div class="detail-section"><h3>为什么这样判断</h3><p>${issue.reason || '当前对象与检测规则或演示文稿中的主流样式不一致。'}</p></div>
    <div class="detail-section advice"><h3>建议如何处理</h3><p>${issue.suggestion || '按建议值调整该对象，使其与页面规范保持一致。'}</p></div>`;
}

export function renderIssueDetail(state) {
  const issues = state.issues || [];
  const idx = Math.min(Math.max(state.currentIssueIndex || 0, 0), Math.max(issues.length - 1, 0));
  const issue = issues[idx] || { page: 1, type: '未知问题', level: 's3', desc: '暂无问题数据' };
  const slides = state.slidePreviews || [];
  const presInfo = state.presInfo || { width: 12192000, height: 6858000 };
  const curSlide = slides.find(slide => slide.page === issue.page) || { page: issue.page, texts: [], shapes: [] };
  const hlIdx = findHighlightIndex(curSlide, issue);
  const hlPos = hlIdx < 0 ? getHighlightPosition(curSlide, issue) : null;
  const hasPreview = curSlide.texts.length > 0 || curSlide.shapes.length > 0;
  const located = hasPreview && (hlIdx >= 0 || Boolean(hlPos));
  const refPos = issue.rule === 'R006' && issue.refPositions ? issue.refPositions : null;
  const alignLine = issue.rule === 'R006' && issue.alignDim && issue.alignValue != null
    ? { dim: issue.alignDim, value: issue.alignValue }
    : null;
  const previewHTML = hasPreview
    ? renderSlidePreview(curSlide, presInfo, PREVIEW_WIDTH, hlIdx, refPos, alignLine, hlPos)
    : `<div class="preview-unavailable"><b>${curSlide.loadError ? '页面加载失败' : '此页无可用预览'}</b><span>${curSlide.loadError || '请打开原始 PowerPoint 查看页面内容。'}</span></div>`;

  const issuePages = [...new Set(issues.map(item => item.page))].sort((a, b) => a - b);
  const curPageIssues = issues.map((item, itemIdx) => ({ ...item, idx: itemIdx })).filter(item => item.page === issue.page);
  const levelLabels = { s1: 'S1 严重', s2: 'S2 高风险', s3: 'S3 一般', s4: 'S4 提示' };
  const panelState = !located ? 'panel-unlocated' : issue.fixable ? 'panel-auto' : 'panel-manual';
  const stageState = !located ? 'stage-unlocated' : !issue.fixable ? 'stage-manual' : '';

  return `
    <div class="detail-top">
      <button class="back-link" onclick="location.hash='issue-list'">← 返回问题列表</button>
      <div class="issue-progress">第 ${issues.length ? idx + 1 : 0} / ${issues.length} 个问题</div>
      <div class="toolbar"><button class="btn" onclick="showIssue(${idx - 1})" ${idx <= 0 ? 'disabled' : ''}>上一个</button><button class="btn" onclick="showIssue(${idx + 1})" ${idx >= issues.length - 1 ? 'disabled' : ''}>下一个</button></div>
    </div>
    <div class="detail detail-v2">
      <div class="detail-workspace">
        <aside class="card detail-pages">
          <div class="detail-pages-title"><b>问题页面</b><span>${issuePages.length} 页</span></div>
          <div class="detail-thumb-list">
            ${issuePages.map(page => {
              const pageIssues = issues.filter(item => item.page === page);
              const firstIdx = issues.findIndex(item => item.page === page);
              const slide = slides.find(item => item.page === page) || { page, texts: [], shapes: [] };
              const highest = [...pageIssues].sort((a, b) => (a.level || 's4').localeCompare(b.level || 's4'))[0]?.level || 's4';
              return `<button class="detail-thumb${page === issue.page ? ' active' : ''}" onclick="showIssue(${firstIdx})" aria-label="查看第 ${page} 页">
                <span class="thumb-render">${renderThumbnail(slide, presInfo, 180, page === issue.page)}</span>
                <span>第 ${page} 页</span><em class="${highest}">${pageIssues.length}</em>
              </button>`;
            }).join('') || '<div class="detail-empty">暂无问题页面</div>'}
          </div>
        </aside>
        <section class="card preview detail-preview">
          <div class="preview-meta"><div><b>第 ${issue.page} 页</b><span>${hasPreview ? `本页 ${curPageIssues.length} 个问题` : '预览异常'}</span></div><span class="preview-note">结构化预览，可能与 PowerPoint 略有差异</span></div>
          <div class="preview-stage ${stageState}"><div class="preview-scale">${previewHTML}</div></div>
          <div class="page-issue-switch ${!located ? 'warning-switch' : ''}">
            ${!located ? '<span>⚠ 无法显示问题标记</span>' : `<span>本页问题</span>${curPageIssues.map((item, pageIdx) => `<button class="${item.idx === idx ? 'active' : ''}" onclick="showIssue(${item.idx})" aria-label="查看本页第 ${pageIdx + 1} 个问题">${pageIdx + 1}</button>`).join('')}`}
          </div>
        </section>
      </div>
      <aside class="card panel detail-panel ${panelState}">
        <div class="issue-heading"><div><span class="badge ${issue.level || 's3'}">${levelLabels[issue.level] || issue.level || '提示'}</span><span class="issue-location">第 ${issue.page} 页 · ${objectLabel(issue)}</span></div><h1>${issue.desc || issue.type || '问题详情'}</h1></div>
        ${renderDetailContent(issue, located)}
        <details class="tech-details"><summary>技术信息</summary><dl>
          <div><dt>规则 ID</dt><dd>${issue.rule || '-'}</dd></div>
          <div><dt>对象 ID</dt><dd>${issue.fixData?.shapeId || '-'}</dd></div>
          <div><dt>标准来源</dt><dd>${issue.source || '-'}</dd></div>
          <div><dt>处理状态</dt><dd>${issue.status || '待处理'}</dd></div>
        </dl></details>
        ${!issue.fixable ? '<div class="manual-note"><b>需手动处理</b><span>自动修改可能改变内容语义或版面结构，请按上方建议在 PowerPoint 中处理。</span></div>' : ''}
        <div class="detail-actions"><button class="btn" id="ignoreIssueBtn" data-idx="${idx}">${issue.status === '已忽略' ? '取消忽略' : '忽略'}</button>${issue.fixable && !state.scanCancelled ? '<button class="btn primary" onclick="toggleFixIssue()">修复此问题</button>' : ''}</div>
      </aside>
    </div>`;
}

window.showIssue = function(idx) {
  const issues = store.get('issues') || [];
  if (idx < 0 || idx >= issues.length) return;
  store.set('currentIssueIndex', idx);
  location.hash = 'issue-detail';
};

window.toggleFixIssue = function() {
  const idx = store.get('currentIssueIndex');
  if (idx < 0) return;
  const selected = new Set(store.get('selectedIssues') || []);
  selected.add(idx);
  store.set('selectedIssues', selected);
  location.hash = 'fix-confirm';
};

function fitPreview() {
  const stage = document.querySelector('.preview-stage');
  const scaleRoot = document.querySelector('.preview-scale');
  const canvas = scaleRoot?.firstElementChild;
  if (!stage || !scaleRoot || !canvas) return;
  scaleRoot.style.transform = '';
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  if (!width || !height) return;
  const scale = Math.min((stage.clientWidth - 32) / width, (stage.clientHeight - 32) / height, 1);
  scaleRoot.style.transform = `scale(${Math.max(scale, 0.1)})`;
}

export function afterRenderIssueDetail() {
  const ignoreBtn = document.getElementById('ignoreIssueBtn');
  if (ignoreBtn) {
    ignoreBtn.addEventListener('click', function() {
      const idx = Number(this.dataset.idx);
      const issues = store.get('issues') || [];
      if (idx < 0 || idx >= issues.length) return;
      const updated = issues.map((item, itemIdx) => itemIdx === idx ? { ...item, status: item.status === '已忽略' ? '待处理' : '已忽略' } : item);
      store.set('issues', updated);
      location.hash = 'issue-detail';
    });
  }
  fitPreview();
  window.addEventListener('resize', fitPreview, { once: true });
}
