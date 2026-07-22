/**
 * R002 空白页面检查
 *
 * 渲染页面自身及母版/版式后，除背景、页码、Logo 和页脚外无其他可见内容时标记为"疑似空白页"。
 * 隐藏页不参与检查。统一为 S3，不支持自动修复。
 */
export const rule = {
  id: 'R002',
  name: '空白页面检查',
  level: 's3',
  fixable: false,
  pageLevel: true,   // 每页独立检查
  crossPage: false,
};

/**
 * 检查单页是否空白
 * @param {Object} slide - { index, page, texts, shapes, hasHidden }
 * @param {Object} presInfo - { width, height, slideCount }
 * @param {Object} context - 上下文（幻灯片所有数据）
 * @returns {Array} 问题数组
 */
export function check(slide, presInfo, context) {
  const issues = [];
  const { texts, shapes, page } = slide;

  // 隐藏页不检查
  if (slide.hasHidden) return issues;

  // 筛选出非辅助元素
  // 辅助元素：位于底部 8% 区域（页脚/页码）、很小的元素（仅装饰）
  const pageHeight = presInfo.height || 6858000;
  const pageWidth = presInfo.width || 12192000;
  const footerZoneBottom = pageHeight * 0.92;

  // 有效文本：不在页脚区、非空
  const meaningfulTexts = texts.filter(t => {
    if (!t.text.trim()) return false;
    // 排除页脚区（底部 8% 且字号较小）
    if (t.y + t.h > footerZoneBottom && (t.fontSize || 12) <= 10) return false;
    // 排除极小的装饰性文字
    if ((t.w || 0) < pageWidth * 0.02 && (t.h || 0) < pageHeight * 0.02) return false;
    return true;
  });

  // 有效形状：不在页脚区、尺寸不小
  const meaningfulShapes = shapes.filter(s => {
    if (s.y + s.h > footerZoneBottom) return false;
    if ((s.w || 0) < pageWidth * 0.02 && (s.h || 0) < pageHeight * 0.02) return false;
    return true;
  });

  if (meaningfulTexts.length === 0 && meaningfulShapes.length === 0) {
    issues.push({
      rule: 'R002',
      type: '空白页面',
      level: 's3',
      page,
      object: `第 ${page} 页`,
      desc: `第 ${page} 页疑似为空白页`,
      detail: '当前页面除背景、页码和页脚等辅助元素外，无可见主体内容。',
      actual: '无可见主体内容',
      expected: '包含文字、图片或形状等主体内容',
      source: '内置规则集 builtin-rules-v1.0',
      reason: '渲染页面自身及母版/版式后，未发现有效文字、图片或主要形状',
      suggestion: '请人工确认是否需要删除此页，或补充页面内容',
      fixable: false,
      status: '待处理',
    });
  }

  return issues;
}
