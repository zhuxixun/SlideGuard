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

function isStandardFont(font) {
  return STANDARD_FONTS.some(f => f.toLowerCase() === String(font).trim().toLowerCase());
}

// Theme placeholders are not physical font names. They must be resolved via
// the theme before they can be judged, so R004 must not report them directly.
function isConcreteFont(font) {
  return Boolean(font && String(font).trim() && !String(font).trim().startsWith('+'));
}

function fontsUsedByRun(run) {
  const text = String(run.text || '');
  const fonts = [];
  // Han, Kana and Hangul characters use the East Asian font slot.
  if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(text)) {
    fonts.push(run.eastAsianFont || run.fontName);
  }
  // Arabic/Hebrew and related complex scripts use the complex-script slot.
  if (/\p{Script=Arabic}|\p{Script=Hebrew}/u.test(text)) {
    fonts.push(run.complexFont || run.fontName);
  }
  // Latin letters and digits use the Latin slot. For punctuation-only runs,
  // fall back to the parser's best-known font instead of guessing a script.
  if (/\p{Script=Latin}|[0-9]/u.test(text)) fonts.push(run.latinFont || run.fontName);
  if (fonts.length === 0) fonts.push(run.fontName);
  return fonts.filter(isConcreteFont);
}

/**
 * @param {Object} slide
 * @param {Object} presInfo
 */
export function check(slide, presInfo) {
  const issues = [];
  const { texts, page } = slide;

  for (const t of texts) {
    if (!t.text.trim()) continue;
    const runFonts = (t.styleRuns || []).flatMap(fontsUsedByRun);
    const candidates = runFonts.length ? runFonts : [t.fontName].filter(isConcreteFont);
    const badFonts = [...new Set(candidates.map(font => String(font).trim()).filter(font => !isStandardFont(font)))];

    if (badFonts.length) {
      const font = badFonts.join('、');
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
          textContent: t.text,
        },
      });
    }
  }

  return issues;
}
