/**
 * R009 敏感及残留文本检查
 *
 * 使用用户维护的本地敏感词库，检查全部可识别文本。
 * 逐字精确匹配，命中 → S1。不支持自动修复。
 */
export const rule = {
  id: 'R009',
  name: '敏感及残留文本检查',
  level: 's1',
  fixable: false,
  pageLevel: true,
  crossPage: false,
  usesWordList: true,  // 需要敏感词库
};

/**
 * @param {Object} slide
 * @param {Object} presInfo
 * @param {Object} context
 */
export function check(slide, presInfo, context) {
  const issues = [];
  const { texts, page } = slide;
  const words = context.sensitiveWords || [];

  if (words.length === 0) return issues;

  for (const t of texts) {
    const text = t.text || '';
    if (!text.trim()) continue;

    for (const word of words) {
      if (!word.trim()) continue;
      let idx = 0;
      while (idx < text.length) {
        const pos = text.indexOf(word, idx);
        if (pos === -1) break;
        issues.push({
          rule: 'R009',
          type: '敏感及残留文本',
          level: 's1',
          page,
          object: `文本框`,
          desc: `第 ${page} 页包含敏感词"${word}"`,
          detail: `文本"${text.slice(Math.max(0, pos - 10), pos + word.length + 10)}"中包含敏感词"${word}"（位置 ${pos + 1}-${pos + word.length} 字符）`,
          actual: `包含词条"${word}"`,
          expected: '不应包含敏感或残留文本',
          source: '本地敏感词库（用户维护）',
          reason: `文本中发现了敏感词库中的词条"${word}"`,
          suggestion: '请人工核实并删除或替换该词条',
          fixable: false,
          status: '待处理',
          sensitiveWord: word,
          charRange: [pos, pos + word.length - 1],
        });
        idx = pos + 1; // 继续查找同词条下个位置
      }
    }
  }

  return issues;
}
