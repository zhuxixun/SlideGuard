/** R008 标题一致性：识别每页唯一标题，检查字体、加粗与颜色。 */
export const rule = {
  id: 'R008', name: '标题一致性检查', level: 's1', fixable: true,
  pageLevel: true, crossPage: false,
};

const STANDARD_FONTS = ['微软雅黑', 'Microsoft YaHei', 'Microsoft YaHei UI'];
const STANDARD_COLOR = 'C00000';

function intersectionRatio(box, region) {
  const left = Math.max(box.x, region.x);
  const top = Math.max(box.y, region.y);
  const right = Math.min(box.x + box.w, region.x + region.w);
  const bottom = Math.min(box.y + box.h, region.y + region.h);
  const area = Math.max(0, right - left) * Math.max(0, bottom - top);
  return box.w > 0 && box.h > 0 ? area / (box.w * box.h) : 0;
}

function selectTitle(slide, presInfo) {
  const nonEmpty = slide.texts.filter(t => t.text?.trim());
  const placeholders = nonEmpty.filter(t => t.isTitle);
  if (placeholders.length) return placeholders[0];

  const region = slide.layoutTitlePos?.w && slide.layoutTitlePos?.h
    ? slide.layoutTitlePos
    : { x: presInfo.width * .05, y: presInfo.height * .03, w: presInfo.width * .9, h: presInfo.height * .19 };
  const candidates = nonEmpty.filter(t => !t.phType && intersectionRatio({
    x: t.visibleX ?? t.x, y: t.visibleY ?? t.y,
    w: t.visibleW ?? t.w, h: t.visibleH ?? t.h,
  }, region) >= .5);
  candidates.sort((a, b) => (b.fontSize || 0) - (a.fontSize || 0) ||
    (a.visibleY ?? a.y) - (b.visibleY ?? b.y) || (a.visibleX ?? a.x) - (b.visibleX ?? b.x));
  return candidates[0] || null;
}

function rangesFor(title, predicate) {
  const runs = (title.styleRuns || []).filter(r => r.text && predicate(r));
  return runs.map(r => `${r.start + 1}-${r.end}`).join('、');
}

function issue(title, slide, property, actual, expected, ranges) {
  const labels = { font: '字体', bold: '字重', color: '颜色' };
  const label = labels[property];
  return {
    rule: 'R008', type: '标题一致性检查', level: 's1', page: slide.page,
    object: title.isTitle ? '标题占位符' : '标题文本框',
    desc: `第 ${slide.page} 页标题${label}不符合规范`,
    detail: `标题“${title.text.slice(0, 40)}”的${label}不符合标准${ranges ? `，命中字符范围：${ranges}` : ''}`,
    actual, expected, source: '内置规则集 builtin-rules-v1.0',
    reason: `标题${label}不符合企业规范`, suggestion: `自动将标题${label}统一为${expected}`,
    fixable: true, status: '待处理', property, charRanges: ranges || '全部可识别字符',
    fixData: { page: slide.page - 1, shapeId: title.shapeId, textContent: title.text,
      x: title.x, y: title.y, w: title.w, h: title.h, property },
  };
}

export function check(slide, presInfo, context = {}) {
  const title = selectTitle(slide, presInfo);
  if (!title) return [];
  const issues = [];
  const runs = title.styleRuns || [];

  // R004 同时启用时由 R004 报告字体，避免同一字体事实重复。
  if (!context.activeRuleIds?.includes('R004')) {
    const badFonts = runs.filter(r => r.fontName && !STANDARD_FONTS.includes(r.fontName));
    if (badFonts.length) issues.push(issue(title, slide, 'font', [...new Set(badFonts.map(r => r.fontName))].join('、'), '微软雅黑', rangesFor(title, r => r.fontName && !STANDARD_FONTS.includes(r.fontName))));
  }
  const badBold = runs.filter(r => r.bold === false);
  if (badBold.length) issues.push(issue(title, slide, 'bold', '未加粗', '加粗', rangesFor(title, r => r.bold === false)));
  const badColors = runs.filter(r => r.color && r.color.toUpperCase() !== STANDARD_COLOR);
  if (badColors.length) issues.push(issue(title, slide, 'color', [...new Set(badColors.map(r => `#${r.color}`))].join('、'), '#C00000 (RGB 192,0,0)', rangesFor(title, r => r.color && r.color.toUpperCase() !== STANDARD_COLOR)));
  return issues;
}

export function checkCrossPage() { return []; }
