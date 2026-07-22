/**
 * R005 字号一致性检查
 *
 * 正文/列表 < 14pt → S3；注释/页脚/图表标签/表格辅助文字 < 10pt → S3。
 * 同层级字号不一致且形成主流值时，偏离 > 2pt → S3。
 * 标题字号由 R009 负责。
 */
export const rule = {
  id: 'R005',
  name: '字号一致性检查',
  level: 's3',
  fixable: true,
  pageLevel: true,
  crossPage: true,   // 跨页检查字号一致性
};

const MIN_BODY_SIZE = 14;   // pt
const MIN_NOTE_SIZE = 10;   // pt

/**
 * 判断文本类型
 */
function guessTextType(t) {
  if (t.phType === 'title' || t.phType === 'ctrTitle') return 'title';
  if (t.phType === 'ftr' || t.phType === 'sldNum') return 'note';
  if ((t.fontSize || 12) <= 10) return 'note';
  if ((t.fontSize || 12) >= 18) return 'title';
  return 'body';
}

/**
 * 页面级检查：字号过小
 */
function checkTooSmall(texts, page) {
  const issues = [];
  for (const t of texts) {
    const type = guessTextType(t);
    if (type === 'title') continue; // R009
    const minSize = type === 'note' ? MIN_NOTE_SIZE : MIN_BODY_SIZE;
    const sz = t.fontSize || 12;
    if (sz < minSize) {
      issues.push({
        rule: 'R005',
        type: '字号过小',
        level: 's3',
        page,
        object: `文本框（${sz}pt）`,
        desc: `第 ${page} 页存在字号过小（${sz}pt${type === 'note' ? '，注释类' : ''}）`,
        detail: `文本"${(t.text || '').slice(0, 30)}"字号为 ${sz}pt，低于${type === 'note' ? '注释类最小字号 10pt' : '正文最小字号 14pt'}`,
        actual: `${sz}pt`,
        expected: type === 'note' ? '≥ 10pt' : '≥ 14pt',
        source: '内置规则集 builtin-rules-v1.0',
        reason: `文本被识别为${type === 'note' ? '注释/页脚' : '正文'}类型，字号 ${sz}pt 低于最小要求`,
        suggestion: type === 'note' ? '建议调整至 10pt 或更大' : '建议调整至 14pt 或更大',
        fixable: true,
        status: '待处理',
      });
    }
  }
  return issues;
}

/**
 * 跨页检查：同层级字号一致性
 * 简化实现：收集正文类型字号，检查是否有主流值，偏离的报告
 */
function checkInconsistency(allSlides, presInfo) {
  const issues = [];
  // 收集所有正文文本的字号
  const bodySizes = [];
  for (const slide of allSlides) {
    for (const t of slide.texts) {
      if (guessTextType(t) !== 'body') continue;
      if (!t.fontSize) continue;
      bodySizes.push({ fontSize: t.fontSize, page: slide.page, text: t.text });
    }
  }

  if (bodySizes.length < 3) return issues; // 样本不足

  // 找主流值
  const freq = {};
  for (const b of bodySizes) {
    const key = Math.round(b.fontSize);
    freq[key] = (freq[key] || 0) + 1;
  }

  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const [mainSize, mainCount] = [parseFloat(entries[0][0]), entries[0][1]];
  const total = bodySizes.length;

  if (mainCount / total < 0.7) return issues; // 未形成主流

  for (const b of bodySizes) {
    if (Math.abs(b.fontSize - mainSize) > 2) {
      issues.push({
        rule: 'R005',
        type: '字号不一致',
        level: 's3',
        page: b.page,
        object: `文本框（${b.fontSize}pt）`,
        desc: `第 ${b.page} 页正文字号 ${b.fontSize}pt 与主流值 ${mainSize}pt 偏差超过 2pt`,
        detail: `文本"${(b.text || '').slice(0, 30)}"字号 ${b.fontSize}pt，主流值为 ${mainSize}pt（${Math.round(mainCount / total * 100)}% 样本使用此字号）`,
        actual: `${b.fontSize}pt`,
        expected: `${mainSize}pt`,
        source: '内置规则集 builtin-rules-v1.0',
        reason: `同类正文样本 ${total} 个，${Math.round(mainCount / total * 100)}% 使用 ${mainSize}pt，当前 ${b.fontSize}pt 偏差 ${Math.round(b.fontSize - mainSize)}pt`,
        suggestion: `建议统一为 ${mainSize}pt`,
        fixable: true,
        status: '待处理',
      });
    }
  }

  return issues;
}

export function check(slide, presInfo) {
  return checkTooSmall(slide.texts, slide.page);
}

export function checkCrossPage(allSlides, presInfo) {
  return checkInconsistency(allSlides, presInfo);
}
