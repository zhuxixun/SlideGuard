/** R008 标题一致性：识别每页唯一标题，检查字体、加粗与颜色。 */
export const rule = {
  id: 'R008', name: '标题一致性检查', level: 's1', fixable: true,
  pageLevel: true, crossPage: false,
};

const STANDARD_FONTS = ['微软雅黑', 'Microsoft YaHei'];
const STANDARD_COLOR = 'C00000';

function intersectionRatio(box, region) {
  const left = Math.max(box.x, region.x);
  const top = Math.max(box.y, region.y);
  const right = Math.min(box.x + box.w, region.x + region.w);
  const bottom = Math.min(box.y + box.h, region.y + region.h);
  const area = Math.max(0, right - left) * Math.max(0, bottom - top);
  return box.w > 0 && box.h > 0 ? area / (box.w * box.h) : 0;
}

export function selectTitle(slide, presInfo) {
  const nonEmpty = slide.texts.filter(t => t.text?.trim());

  function candidatesByRegion(region) {
    // 占位符类型只描述模板原始意图，用户可能移动或改作他用；标题只按最终视觉位置判断。
    return nonEmpty.filter(t => intersectionRatio({
      x: t.visibleX ?? t.x, y: t.visibleY ?? t.y,
      w: t.visibleW ?? t.w, h: t.visibleH ?? t.h,
    }, region) >= .5);
  }

  // 不采用母版/版式的标题占位符区域：实际文件可能已把占位符移作正文。
  const visualTitleBand = {
    x: presInfo.width * .03,
    y: presInfo.height * .02,
    w: presInfo.width * .94,
    h: presInfo.height * .20,
  };
  const candidates = candidatesByRegion(visualTitleBand);

  // 位置优先于字号。字号经常继承自母版而在当前页 XML 中为空，不能让 null(0) 的真实标题
  // 输给下方显式写了小字号的正文。
  candidates.sort((a, b) =>
    (a.visibleY ?? a.y) - (b.visibleY ?? b.y) ||
    (b.fontSize || 0) - (a.fontSize || 0) ||
    (a.visibleX ?? a.x) - (b.visibleX ?? b.x));
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
    object: (title.phType === 'title' || title.phType === 'ctrTitle') ? '标题占位符' : '标题文本框',
    desc: `第 ${slide.page} 页标题${label}不符合规范`,
    detail: `标题“${title.text.slice(0, 40)}”的${label}不符合标准${ranges ? `，命中字符范围：${ranges}` : ''}`,
    actual, expected, source: '内置规则集 builtin-rules-v1.0',
    reason: `标题${label}不符合企业规范`, suggestion: `自动将标题${label}统一为${expected}`,
    fixable: true, status: '待处理', property, charRanges: ranges || '全部可识别字符',
    fixData: { page: slide.page - 1, shapeIndex: title.shapeIndex, shapeId: title.shapeId, textContent: title.text,
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
    const isBadFont = n => n && !STANDARD_FONTS.some(f => f.toLowerCase() === n.trim().toLowerCase());
    const badFonts = runs.filter(r => isBadFont(r.fontName));
    if (badFonts.length) issues.push(issue(title, slide, 'font', [...new Set(badFonts.map(r => r.fontName))].join('、'), '微软雅黑', rangesFor(title, r => isBadFont(r.fontName))));
  }
  const badBold = runs.filter(r => r.bold === false);
  if (badBold.length) issues.push(issue(title, slide, 'bold', '未加粗', '加粗', rangesFor(title, r => r.bold === false)));
  // An unresolved inherited colour is not evidence of a visual mismatch.
  // Reporting it as non-compliant caused false positives for valid OOXML
  // inheritance paths that this lightweight parser cannot fully reproduce.
  // Only a positively resolved, non-standard RGB value may fail the rule.
  const badColors = runs.filter(r => r.color && r.color.toUpperCase() !== STANDARD_COLOR);
  if (badColors.length) issues.push(issue(title, slide, 'color', [...new Set(badColors.map(r => `#${r.color}`))].join('、'), '#C00000 (RGB 192,0,0)', rangesFor(title, r => r.color && r.color.toUpperCase() !== STANDARD_COLOR)));
  return issues;
}

export function checkCrossPage() { return []; }
