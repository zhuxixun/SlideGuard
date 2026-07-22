/**
 * R003 页面外元素检查
 *
 * 完全位于画布外的非母版对象：含文字 → S2，不含文字的图片/形状 → S3。
 * 部分越界仅检查文字是否被裁断（R006）。
 * 组合对象按整体边界判断。
 * 不支持自动修复。
 */
export const rule = {
  id: 'R003',
  name: '页面外元素检查',
  level: 's2',
  fixable: false,
  pageLevel: true,
  crossPage: false,
};

/**
 * 判断元素是否完全在画布外
 */
function isFullyOutside(x, y, w, h, pw, ph) {
  return x + w <= 0 || y + h <= 0 || x >= pw || y >= ph;
}

/**
 * @param {Object} slide
 * @param {Object} presInfo
 */
export function check(slide, presInfo) {
  const issues = [];
  const { texts, shapes, page } = slide;
  const pw = presInfo.width || 12192000;
  const ph = presInfo.height || 6858000;

  // 检查文本元素
  for (const t of texts) {
    if (isFullyOutside(t.x, t.y, t.w, t.h, pw, ph)) {
      issues.push({
        rule: 'R003',
        type: '页面外元素',
        level: 's2',
        page,
        object: `文本框`,
        desc: `第 ${page} 页存在完全位于画布外的文字元素（"${(t.text || '').slice(0, 30)}"）`,
        detail: `该文本框完全位于幻灯片画布之外，可能为拖动残留。位置：(${Math.round(t.x)}, ${Math.round(t.y)})，尺寸：${Math.round(t.w)}×${Math.round(t.h)}`,
        actual: `元素在画布外 (${Math.round(t.x)}, ${Math.round(t.y)})`,
        expected: '元素应在画布区域内',
        source: '内置规则集 builtin-rules-v1.0',
        reason: '对象可见区域与幻灯片画布无交集',
        suggestion: '请人工确认是否需要删除或移回画布内',
        fixable: false,
        status: '待处理',
      });
    }
  }

  // 检查非文本形状
  for (const s of shapes) {
    if (isFullyOutside(s.x, s.y, s.w, s.h, pw, ph)) {
      issues.push({
        rule: 'R003',
        type: '页面外元素',
        level: 's3',
        page,
        object: s.name || '形状',
        desc: `第 ${page} 页存在完全位于画布外的${s.name || '形状'}`,
        detail: `该元素完全位于幻灯片画布之外。位置：(${Math.round(s.x)}, ${Math.round(s.y)})，尺寸：${Math.round(s.w)}×${Math.round(s.h)}`,
        actual: `元素在画布外 (${Math.round(s.x)}, ${Math.round(s.y)})`,
        expected: '元素应在画布区域内',
        source: '内置规则集 builtin-rules-v1.0',
        reason: '对象可见区域与幻灯片画布无交集',
        suggestion: '请人工确认是否需要删除或移回画布内',
        fixable: false,
        status: '待处理',
      });
    }
  }

  return issues;
}
