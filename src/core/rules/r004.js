/**
 * R004 字体一致性检查
 *
 * 所有可识别文本的字体必须为"微软雅黑"或"Microsoft YaHei"。
 * 非标准字体 → S1。支持自动替换为微软雅黑。
 */
export const rule = {
  id: 'R004',
  name: '字体一致性检查',
  level: 's1',
  fixable: true,
  pageLevel: true,
  crossPage: false,
};

const STANDARD_FONTS = ['微软雅黑', 'Microsoft YaHei', 'Microsoft YaHei UI'];

/**
 * @param {Object} slide
 * @param {Object} presInfo
 */
export function check(slide, presInfo) {
  const issues = [];
  const { texts, page } = slide;

  for (const t of texts) {
    if (!t.text.trim()) continue;
    const font = (t.fontName || '微软雅黑').trim();

    if (!STANDARD_FONTS.includes(font)) {
      issues.push({
        rule: 'R004',
        type: '字体一致性',
        level: 's1',
        page,
        object: `文本框（字体：${font}）`,
        desc: `第 ${page} 页存在非标准字体"${font}"`,
        detail: `文本"${(t.text || '').slice(0, 50)}"使用了非标准字体"${font}"，应为"微软雅黑"。`,
        actual: `字体：${font}`,
        expected: '微软雅黑 / Microsoft YaHei',
        source: '内置规则集 builtin-rules-v1.0',
        reason: `当前字体"${font}"不是标准字体"微软雅黑"或其英文名称"Microsoft YaHei"`,
        suggestion: '自动替换为微软雅黑，或人工确认后替换',
        fixable: true,
        status: '待处理',
        // 修复所需数据
        fixData: {
          page: page - 1, // 0-based
          shapeId: t.shapeId,
          targetFont: '微软雅黑',
        },
      });
    }
  }

  return issues;
}
