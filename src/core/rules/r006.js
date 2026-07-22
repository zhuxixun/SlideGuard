/**
 * R006 文本溢出检查
 *
 * 使用 Canvas API 测量实际文本宽度，结合文本框尺寸判断是否溢出。
 * 支持：字体缺失检测、容差 2pt、S2/S3 分级。
 */
export const rule = {
  id: 'R006',
  name: '文本溢出检查',
  level: 's2',
  fixable: false,
  pageLevel: true,
  crossPage: false,
};

// 单位转换
const EMU_PER_PT = 12700;
const PX_PER_EMU = 96 / 914400;   // 1 EMU → px at 96dpi
const LINE_SPACING = 1.4;

/**
 * 使用 Canvas 测量单行文本宽度（px）
 */
let _canvas = null;
function measureTextWidth(text, fontSizePt, fontFamily, bold) {
  if (!_canvas) {
    _canvas = document.createElement('canvas');
    _canvas.width = 1;
    _canvas.height = 1;
  }
  const ctx = _canvas.getContext('2d');
  const weight = bold ? 'bold ' : '';
  // 使用后备字体确保测量始终有效
  ctx.font = `${weight}${fontSizePt}pt "${fontFamily}", "Microsoft YaHei", "Segoe UI", sans-serif`;
  return ctx.measureText(text).width;
}

/**
 * 检查字体是否可用
 */
function isFontAvailable(fontName) {
  try {
    return document.fonts && document.fonts.check(`12pt "${fontName}"`);
  } catch (e) {
    return false;
  }
}

/**
 * 计算文本在指定框宽下的排版高度（px）
 * 对 CJK 文本按字符宽度换行，对含空格的文本按单词换行
 */
function calcLayoutHeight(text, fontSizePt, fontFamily, bold, boxWidthPx) {
  if (!text || !fontSizePt || !boxWidthPx || boxWidthPx <= 0) return 0;

  // 行高
  const lineHeightPx = fontSizePt * 1.333 * LINE_SPACING;

  // 如果只有一行宽度，快速判断
  const singleLineWidth = measureTextWidth(text, fontSizePt, fontFamily, bold);
  if (singleLineWidth <= boxWidthPx) return lineHeightPx;

  // 多行：逐词/逐字换行
  // CJK 文本每个字符宽度相近，按字符切分
  // 含空格的文本按单词切分
  const hasSpaces = /\s/.test(text);
  const tokens = hasSpaces ? text.split(/(\s+)/) : text.split('');

  let lines = 1;
  let currentLineWidth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    const tokenWidth = measureTextWidth(token, fontSizePt, fontFamily, bold);

    if (currentLineWidth + tokenWidth > boxWidthPx) {
      // 换行
      lines++;
      currentLineWidth = tokenWidth;
    } else {
      currentLineWidth += tokenWidth;
    }
  }

  return lines * lineHeightPx;
}

/**
 * @param {Object} slide - { texts, page, ... }
 * @param {Object} presInfo - { width, height }
 */
export function check(slide, presInfo) {
  const issues = [];
  const { texts, page } = slide;

  for (const t of texts) {
    const text = t.text || '';
    if (!text.trim() || !t.fontSize) continue;

    const boxWEmu = t.w || 0;
    const boxHEmu = t.h || 0;
    if (boxWEmu <= 0 || boxHEmu <= 0) continue;

    // 转换为 px
    const boxWPx = boxWEmu * PX_PER_EMU;
    const boxHPx = boxHEmu * PX_PER_EMU;
    const tolerancePx = 2 * 1.333; // 2pt → px

    // 检查字体是否可用
    const fontName = t.fontName || 'Microsoft YaHei';
    const fontAvailable = isFontAvailable(fontName);

    if (!fontAvailable && fontName !== 'Microsoft YaHei' && fontName !== '微软雅黑') {
      // 字体缺失 → 标记风险，不判定溢出
      issues.push({
        rule: 'R006',
        type: '文本溢出',
        level: 's3',
        page,
        object: `文本框`,
        desc: `第 ${page} 页存在字体缺失风险（${fontName}）`,
        detail: `文本"${text.slice(0, 40)}"使用了字体"${fontName}"，该字体在系统中未找到，排版测量不可靠`,
        actual: `字体：${fontName}（缺失）`,
        expected: `应使用可用字体`,
        source: '内置规则集 builtin-rules-v1.0',
        reason: `字体"${fontName}"缺失，浏览器使用替代字体渲染，实际排版可能与 PPT 设计不一致`,
        suggestion: '建议将字体替换为微软雅黑以确保排版一致，或确认目标环境中已安装该字体',
        fixable: false,
        status: '待处理',
        fontMissing: true,
      });
      continue;
    }

    // 使用 Canvas 精确测量排版高度
    const neededPx = calcLayoutHeight(text, t.fontSize, fontName, t.bold, boxWPx);

    if (neededPx > boxHPx + tolerancePx) {
      const overflowPx = neededPx - boxHPx;
      const overflowPt = overflowPx / 1.333;
      const severity = overflowPt > boxHEmu / EMU_PER_PT * 0.5 ? 's2' : 's3';

      issues.push({
        rule: 'R006',
        type: '文本溢出',
        level: severity,
        page,
        object: `文本框`,
        desc: `第 ${page} 页文本超出文本框${severity === 's2' ? '（超出超过 50%）' : ''}`,
        detail: `文本"${text.slice(0, 50)}"使用 ${t.fontSize}pt ${fontName}，估算排版高度 ${neededPx.toFixed(0)}px（${(neededPx / 1.333).toFixed(0)}pt），文本框高度 ${(boxHPx / 1.333).toFixed(0)}pt`,
        actual: `排版需要 ${(neededPx / 1.333).toFixed(0)}pt`,
        expected: `文本框 ${(boxHPx / 1.333).toFixed(0)}pt 应足够容纳`,
        source: '内置规则集 builtin-rules-v1.0',
        reason: `文本在 ${t.fontSize}pt 下排版高度超出文本框 ${overflowPt.toFixed(0)}pt`,
        suggestion: severity === 's2'
          ? '关键文字被裁断或完全不可见，请立即缩小字号或增大文本框'
          : '建议适当缩小字号、精简文本或增大文本框',
        fixable: false,
        status: '待处理',
        overflowPt: Math.round(overflowPt),
      });
    }
  }

  return issues;
}
