/**
 * R009 标题一致性检查
 *
 * 只检查 PowerPoint 标题占位符（isTitle）。
 * 样式：微软雅黑、24pt、加粗、RGB(192,0,0)。
 * 非标准字体 → S1（同时遵循 R004）；颜色不一致 → S1；字号/字重/位置不一致 → S3。
 * 支持自动修复。
 */
export const rule = {
  id: 'R009',
  name: '标题一致性检查',
  level: 's1',
  fixable: true,
  pageLevel: true,
  crossPage: true,
};

const EXPECTED = {
  font: '微软雅黑',
  fontSize: 24,       // pt
  bold: true,
  color: '#C00000',   // RGB(192,0,0)
};

const STANDARD_FONTS = ['微软雅黑', 'Microsoft YaHei', 'Microsoft YaHei UI'];

/**
 * 估算文本在指定字号和框宽下所需高度（EMU）
 */
function estimateTextHeight(text, fontSizePt, boxWidthEmu) {
  if (!text || !fontSizePt || !boxWidthEmu) return 0;
  const charWidth = fontSizePt * 12700 * 0.85; // 中英文混合平均宽度
  const charsPerLine = Math.max(1, Math.floor(boxWidthEmu / charWidth));
  const lines = Math.ceil(text.length / charsPerLine);
  const lineHeight = fontSizePt * 12700 * 1.4;
  return lines * lineHeight;
}

/**
 * 检测标题在 24pt 下是否溢出，并检查冒号
 */
function checkTitleOverflow(t, page) {
  const issues = [];
  const text = t.text || '';
  if (!text.trim() || !t.w || !t.h) return issues;
  if (t.fontSize && t.fontSize !== 24) return issues; // 非24pt由字号一致性处理

  const boxW = t.w;
  const boxH = t.h;
  const tolerance = 2 * 12700;
  const estH = estimateTextHeight(text, 24, boxW);

  if (estH <= boxH + tolerance) return issues; // 不溢出

  // 检测冒号
  const colonIdx = findFirstColon(text);
  const hasColon = colonIdx >= 0;

  if (hasColon) {
    const afterColon = text.slice(colonIdx + 1);
    if (afterColon.trim()) {
      // 计算冒号后文字在剩余空间中单行不溢出的最小字号
      // 剩余宽度 = 文本框宽度
      const minSizeAfter = calcMinSingleLineSize(afterColon, boxW);
      const targetSize = Math.max(14, Math.ceil(minSizeAfter));
      const willFit = minSizeAfter <= 24 && targetSize >= 14;

      if (willFit) {
        issues.push({
          rule: 'R009',
          type: '标题一致性',
          level: 's3',
          page,
          object: '标题占位符',
          desc: `第 ${page} 页标题在 24pt 下溢出，可通过冒号分割缩小后半部分至 ${targetSize}pt`,
          detail: `标题"${text.slice(0, 40)}"在 24pt 下超出文本框，包含冒号。冒号前保持 24pt（可换行），冒号后缩小至 ${targetSize}pt`,
          actual: `24pt 下需要 ${Math.round(estH)} EMU，文本框高 ${boxH} EMU`,
          expected: `冒号后缩小至 ${targetSize}pt 使排版不溢出`,
          source: '内置规则集 builtin-rules-v1.0',
          reason: `标题在 24pt 下排版溢出 ${Math.round((estH - boxH) / 12700)}pt，包含冒号可分割处理`,
          suggestion: `冒号前保持 24pt，冒号后缩小至 ${targetSize}pt`,
          fixable: true,
          status: '待处理',
          // 修复数据
          fixData: {
            type: 'title-overflow',
            page: page - 1,
            shapeId: t.shapeId,
            colonIndex: colonIdx,
            textBefore: text.slice(0, colonIdx + 1),
            textAfter: text.slice(colonIdx + 1),
            targetSizeAfter: Math.round(targetSize),
          },
        });
      } else {
        issues.push({
          rule: 'R009',
          type: '标题一致性',
          level: 's3',
          page,
          object: '标题占位符',
          desc: `第 ${page} 页标题在 24pt 下溢出，即使缩小至 14pt 仍无法容纳`,
          detail: `标题"${text.slice(0, 40)}"包含冒号，但冒号后文字缩小到 14pt 仍超出文本框`,
          actual: `冒号后文字在 14pt 下仍溢出`,
          expected: '排版不溢出',
          source: '内置规则集 builtin-rules-v1.0',
          reason: `冒号后文字即使缩小到最小 14pt 仍无法在单行内完整显示`,
          suggestion: '请人工精简冒号后文字或调整文本框大小',
          fixable: false,
          status: '待处理',
        });
      }
    }
  } else {
    // 无冒号
    issues.push({
      rule: 'R009',
      type: '标题一致性',
      level: 's3',
      page,
      object: '标题占位符',
      desc: `第 ${page} 页标题在 24pt 下溢出，且无冒号可分割`,
      detail: `标题"${text.slice(0, 40)}"在 24pt 下超出文本框，且没有冒号可做分割点`,
      actual: `24pt 下需要 ${Math.round(estH)} EMU，文本框高 ${boxH} EMU`,
      expected: '排版不溢出',
      source: '内置规则集 builtin-rules-v1.0',
      reason: `标题排版高度超出文本框 ${Math.round((estH - boxH) / 12700)}pt，且无冒号`,
      suggestion: '请人工精简标题文字或调整文本框大小',
      fixable: false,
      status: '待处理',
    });
  }

  return issues;
}

/**
 * 找到第一个冒号位置（中文或英文）
 */
function findFirstColon(text) {
  const cn = text.indexOf('：');
  const en = text.indexOf(':');
  if (cn >= 0 && en >= 0) return Math.min(cn, en);
  return cn >= 0 ? cn : en;
}

/**
 * 计算文本在指定宽度下单行显示所需最小字号
 */
function calcMinSingleLineSize(text, boxWidthEmu) {
  if (!text || !boxWidthEmu) return 24;
  // 文本总宽度 = 字符数 × 字号 × 0.85 × 12700
  // 需要 text.length * size * 12700 * 0.85 <= boxWidthEmu
  // size <= boxWidthEmu / (text.length * 12700 * 0.85)
  const size = boxWidthEmu / (text.length * 12700 * 0.85);
  return Math.min(24, Math.max(8, size));
}

/**
 * 页面级：检查标题文本样式
 */
function checkStyle(slide, presInfo) {
  const issues = [];
  const { texts, page } = slide;

  const titles = texts.filter(t => t.isTitle);
  for (const t of titles) {
    if (!t.text.trim()) continue;

    // 字体 → S1（或由 R004 覆盖）
    const font = (t.fontName || '').trim();
    if (font && !STANDARD_FONTS.includes(font)) {
      issues.push({
        rule: 'R009',
        type: '标题一致性',
        level: 's1',
        page,
        object: `标题占位符`,
        desc: `第 ${page} 页标题字体"${font}"不是标准字体`,
        detail: `标题"${(t.text || '').slice(0, 30)}"使用非标准字体"${font}"，应为"微软雅黑"`,
        actual: `字体：${font || '未指定'}`,
        expected: `字体：微软雅黑`,
        source: '内置规则集 builtin-rules-v1.0',
        reason: '标题字体不符合规范，应使用微软雅黑',
        suggestion: '自动替换为微软雅黑',
        fixable: true,
        status: '待处理',
      });
    }

    // 颜色 → S1
    if (t.color && t.color.toUpperCase() !== 'C00000') {
      issues.push({
        rule: 'R009',
        type: '标题一致性',
        level: 's1',
        page,
        object: `标题占位符`,
        desc: `第 ${page} 页标题颜色 #${t.color} 与标准颜色不一致`,
        detail: `标题"${(t.text || '').slice(0, 30)}"颜色为 #${t.color}，应为 #C00000 (RGB 192,0,0)`,
        actual: `颜色：#${t.color}`,
        expected: '#C00000 (RGB 192,0,0)',
        source: '内置规则集 builtin-rules-v1.0',
        reason: '标题颜色不符合企业规范',
        suggestion: '自动替换为 RGB(192,0,0)',
        fixable: true,
        status: '待处理',
      });
    }

    // 字号 → S3
    if (t.fontSize && t.fontSize !== EXPECTED.fontSize) {
      issues.push({
        rule: 'R009',
        type: '标题一致性',
        level: 's3',
        page,
        object: `标题占位符`,
        desc: `第 ${page} 页标题字号 ${Math.round(t.fontSize)}pt 与标准 24pt 不一致`,
        detail: `标题"${(t.text || '').slice(0, 30)}"字号为 ${Math.round(t.fontSize)}pt，标准为 24pt`,
        actual: `${Math.round(t.fontSize)}pt`,
        expected: '24pt',
        source: '内置规则集 builtin-rules-v1.0',
        reason: '标题字号不符合标准',
        suggestion: '自动调整为 24pt',
        fixable: true,
        status: '待处理',
      });
    }

    // 字重 → S3
    if (!t.bold) {
      issues.push({
        rule: 'R009',
        type: '标题一致性',
        level: 's3',
        page,
        object: `标题占位符`,
        desc: `第 ${page} 页标题未加粗`,
        detail: `标题"${(t.text || '').slice(0, 30)}"字重为普通，应为加粗`,
        actual: '字重：普通',
        expected: '加粗',
        source: '内置规则集 builtin-rules-v1.0',
        reason: '标题字重不符合标准',
        suggestion: '自动设置为加粗',
        fixable: true,
        status: '待处理',
      });
    }

    // 超长标题溢出检查（在 24pt 下是否超出文本框）
    const overflowIssues = checkTitleOverflow(t, page);
    issues.push(...overflowIssues);
  }

  return issues;
}

/**
 * 跨页级：检查标题位置一致性
 */
function checkPosition(allSlides, presInfo) {
  const issues = [];

  // 收集所有标题位置
  const titlePositions = [];
  for (const slide of allSlides) {
    const titles = slide.texts.filter(t => t.isTitle);
    for (const t of titles) {
      titlePositions.push({ page: slide.page, x: t.x, y: t.y });
    }
  }

  if (titlePositions.length < 2) return issues;

  // 用 x 坐标聚类（同一版式标题应在相近 x 位置）
  const xVals = titlePositions.map(t => t.x);
  const tolerance = 3 * 12700;
  const cluster = clusterValues(xVals, tolerance);

  if (cluster && cluster.length >= 2) {
    const avgX = cluster.indices.reduce((s, i) => s + xVals[i], 0) / cluster.length;
    for (const t of titlePositions) {
      if (Math.abs(t.x - avgX) > tolerance) {
        issues.push({
          rule: 'R009',
          type: '标题一致性',
          level: 's3',
          page: t.page,
          object: `标题占位符`,
          desc: `第 ${t.page} 页标题位置与主流参考线不一致`,
          detail: `标题左侧位置 ${Math.round(t.x / 12700)}pt，主流参考线 ${Math.round(avgX / 12700)}pt，偏差 ${Math.round(Math.abs(t.x - avgX) / 12700)}pt`,
          actual: `左侧位置：${Math.round(t.x / 12700)}pt`,
          expected: `左侧位置：${Math.round(avgX / 12700)}pt`,
          source: '内置规则集 builtin-rules-v1.0',
          reason: `同类标题 ${titlePositions.length} 个，参考线为 ${Math.round(avgX / 12700)}pt，当前偏差 ${Math.round(Math.abs(t.x - avgX) / 12700)}pt`,
          suggestion: `建议将标题左侧对齐至 ${Math.round(avgX / 12700)}pt`,
          fixable: true,
          status: '待处理',
        });
      }
    }
  }

  return issues;
}

function clusterValues(vals, tolerance) {
  const n = vals.length;
  let best = { indices: [], length: 0 };
  for (let i = 0; i < n; i++) {
    const group = { indices: [i] };
    for (let j = 0; j < n; j++) {
      if (i !== j && Math.abs(vals[j] - vals[i]) <= tolerance) {
        group.indices.push(j);
      }
    }
    if (group.indices.length > best.length) {
      best = group;
    }
  }
  return best.length >= 2 ? best : null;
}

export function check(slide, presInfo) {
  return checkStyle(slide, presInfo);
}

export function checkCrossPage(allSlides, presInfo) {
  return checkPosition(allSlides, presInfo);
}
