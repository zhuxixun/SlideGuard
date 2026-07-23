/**
 * R008 标题一致性检查
 *
 * 只检查 PowerPoint 标题占位符（isTitle / ctrTitle）。
 * 样式：微软雅黑、24pt、加粗、RGB(192,0,0)，并与版式标题参考线（左侧）对齐。
 * 非标准字体/标题颜色不一致 → S1；字号/字重/位置偏移 → S3。
 * 支持自动修复（字体、字号、加粗、颜色、超长标题冒号分割）。
 */
export const rule = {
  id: 'R008',
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
  // 仅当标题使用标准 24pt（或未明确指定）时才检查溢出
  if (t.fontSize && t.fontSize !== 24) return issues;

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
      const minSizeAfter = calcMinSingleLineSize(afterColon, boxW);
      const targetSize = Math.max(14, Math.ceil(minSizeAfter));
      const willFit = minSizeAfter <= 24 && targetSize >= 14;

      if (willFit) {
        issues.push({
          rule: 'R008',
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
          fixData: {
            type: 'title-overflow',
            page: page - 1,
            shapeId: t.shapeId,
            textContent: t.text,
            colonIndex: colonIdx,
            textBefore: text.slice(0, colonIdx + 1),
            textAfter: text.slice(colonIdx + 1),
            targetSizeAfter: Math.round(targetSize),
            x: t.x, y: t.y, w: t.w, h: t.h,
          },
        });
      } else {
        issues.push({
          rule: 'R008',
          type: '标题一致性',
          level: 's3',
          page,
          object: '标题占位符',
          desc: `第 ${page} 页标题在 24pt 下溢出，即使缩小至 14pt 仍无法容纳`,
          detail: `标题"${text.slice(0, 40)}"包含冒号，但冒号后文字缩小到 14pt 仍超出文本框`,
          actual: '冒号后文字在 14pt 下仍溢出',
          expected: '排版不溢出',
          source: '内置规则集 builtin-rules-v1.0',
          reason: '冒号后文字即使缩小到最小 14pt 仍无法在单行内完整显示',
          suggestion: '请人工精简冒号后文字或调整文本框大小',
          fixable: false,
          status: '待处理',
        });
      }
    }
  } else {
    // 无冒号
    issues.push({
      rule: 'R008',
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
  const size = boxWidthEmu / (text.length * 12700 * 0.85);
  return Math.min(24, Math.max(8, size));
}

/**
 * 页面级：检查标题位置是否与版式参考线（左侧）对齐
 * PRD: 优先采用当前版式标题占位符的左侧位置；偏差超过3pt → S3
 */
function checkLayoutAlignment(t, slide) {
  const issues = [];
  const layoutPos = slide.layoutTitlePos;
  if (!layoutPos) return issues;

  const tolerance = 3 * 12700; // 3pt
  const dx = Math.abs(t.x - layoutPos.x);

  if (dx > tolerance) {
    issues.push({
      rule: 'R008',
      type: '标题一致性',
      level: 's3',  // PRD: 位置偏差 → S3
      page: slide.page,
      object: '标题占位符',
      desc: `第 ${slide.page} 页标题左侧位置与版式参考线不一致`,
      detail: `标题左侧偏差 ${Math.round(dx / 12700)}pt（当前 ${Math.round(t.x / 12700)}pt，版式参考线 ${Math.round(layoutPos.x / 12700)}pt）`,
      actual: `左侧位置：${Math.round(t.x / 12700)}pt`,
      expected: `左侧对齐版式参考线 ${Math.round(layoutPos.x / 12700)}pt`,
      source: '内置规则集 builtin-rules-v1.0',
      reason: `标题左侧 ${Math.round(t.x / 12700)}pt 偏离版式参考线 ${Math.round(layoutPos.x / 12700)}pt 超过 ${Math.round(tolerance / 12700)}pt`,
      suggestion: `建议将标题左侧对齐至 ${Math.round(layoutPos.x / 12700)}pt`,
      fixable: false,
      status: '待处理',
    });
  }

  return issues;
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

    // 字体 → S1（同时遵循 R004）
    const font = (t.fontName || '').trim();
    if (font && !STANDARD_FONTS.includes(font)) {
      issues.push({
        rule: 'R008',
        type: '标题一致性',
        level: 's1',
        page,
        object: '标题占位符',
        desc: `第 ${page} 页标题字体"${font}"不是标准字体`,
        detail: `标题"${(t.text || '').slice(0, 30)}"使用非标准字体"${font}"，应为"微软雅黑"`,
        actual: `字体：${font || '未指定'}`,
        expected: '字体：微软雅黑',
        source: '内置规则集 builtin-rules-v1.0',
        reason: '标题字体不符合规范，应使用微软雅黑',
        suggestion: '自动替换为微软雅黑',
        fixable: true,
        status: '待处理',
        fixData: {
          page: page - 1,
          shapeId: t.shapeId,
          textContent: t.text,
          x: t.x, y: t.y, w: t.w, h: t.h,
        },
      });
    }

    // 颜色 → S1
    if (t.color && t.color.toUpperCase() !== 'C00000') {
      issues.push({
        rule: 'R008',
        type: '标题一致性',
        level: 's1',
        page,
        object: '标题占位符',
        desc: `第 ${page} 页标题颜色 #${t.color} 与标准颜色不一致`,
        detail: `标题"${(t.text || '').slice(0, 30)}"颜色为 #${t.color}，应为 #C00000 (RGB 192,0,0)`,
        actual: `颜色：#${t.color}`,
        expected: '#C00000 (RGB 192,0,0)',
        source: '内置规则集 builtin-rules-v1.0',
        reason: '标题颜色不符合企业规范',
        suggestion: '自动替换为 RGB(192,0,0)',
        fixable: true,
        status: '待处理',
        fixData: {
          page: page - 1,
          shapeId: t.shapeId,
          textContent: t.text,
          x: t.x, y: t.y, w: t.w, h: t.h,
        },
      });
    }

    // 字号 → S3（PRD: 标题字号不一致报告为 S3）
    if (t.fontSize && t.fontSize !== EXPECTED.fontSize) {
      issues.push({
        rule: 'R008',
        type: '标题一致性',
        level: 's3',
        page,
        object: '标题占位符',
        desc: `第 ${page} 页标题字号 ${Math.round(t.fontSize)}pt 与标准 24pt 不一致`,
        detail: `标题"${(t.text || '').slice(0, 30)}"字号为 ${Math.round(t.fontSize)}pt，标准为 24pt`,
        actual: `${Math.round(t.fontSize)}pt`,
        expected: '24pt',
        source: '内置规则集 builtin-rules-v1.0',
        reason: '标题字号不符合标准',
        suggestion: '自动调整为 24pt',
        fixable: true,
        status: '待处理',
        fixData: {
          page: page - 1,
          shapeId: t.shapeId,
          textContent: t.text,
          x: t.x, y: t.y, w: t.w, h: t.h,
        },
      });
    }

    // 字重 → S3（PRD: 标题字重不一致报告为 S3）
    if (t.bold === false) {
      issues.push({
        rule: 'R008',
        type: '标题一致性',
        level: 's3',
        page,
        object: '标题占位符',
        desc: `第 ${page} 页标题未加粗`,
        detail: `标题"${(t.text || '').slice(0, 30)}"字重为普通，应为加粗`,
        actual: '字重：普通',
        expected: '加粗',
        source: '内置规则集 builtin-rules-v1.0',
        reason: '标题字重不符合标准',
        suggestion: '自动设置为加粗',
        fixable: true,
        status: '待处理',
        fixData: {
          page: page - 1,
          shapeId: t.shapeId,
          textContent: t.text,
          x: t.x, y: t.y, w: t.w, h: t.h,
        },
      });
    }

    // 与版式标题参考线对齐（左侧位置）
    const alignIssues = checkLayoutAlignment(t, slide);
    issues.push(...alignIssues);

    // 超长标题溢出检查（在 24pt 下是否超出文本框）
    const overflowIssues = checkTitleOverflow(t, page);
    issues.push(...overflowIssues);
  }

  return issues;
}

/**
 * 跨页级：回退聚类 — 当 layoutTitlePos 不可用时，
 * 对同一版式至少3页且≥70%标题左侧偏差≤3pt的形成参考线。
 * PRD: 无法形成参考线时只检查文字样式，不检查位置。
 */
function checkPosition(allSlides, presInfo) {
  const issues = [];

  // 收集每个版式的标题位置（只取缺少 layoutTitlePos 的幻灯片）
  const layoutGroups = {};
  for (const slide of allSlides) {
    if (slide.layoutTitlePos) continue; // 已有 layout 参考线，跳过
    const titles = slide.texts.filter(t => t.isTitle && t.text.trim());
    if (titles.length === 0) continue;

    // 按版式路径分组；无路径时统一归入 unknown
    const groupKey = slide.layoutPath || 'unknown-layout';
    if (!layoutGroups[groupKey]) layoutGroups[groupKey] = [];
    for (const t of titles) {
      layoutGroups[groupKey].push({ page: slide.page, x: t.x });
    }
  }

  for (const entries of Object.values(layoutGroups)) {
    // PRD: 至少3页
    if (entries.length < 3) continue;

    // PRD: ≥70% 标题左侧位置彼此偏差不超过 3pt → 形成参考线
    const tolerance = 3 * 12700;
    const refLine = findReferenceLine(entries, tolerance);
    if (!refLine) continue; // 无法形成参考线，跳过位置检查

    // 对偏离参考线的标题生成问题
    for (const entry of entries) {
      if (Math.abs(entry.x - refLine) > tolerance) {
        issues.push({
          rule: 'R008',
          type: '标题一致性',
          level: 's3',
          page: entry.page,
          object: '标题占位符',
          desc: `第 ${entry.page} 页标题左侧位置与主流参考线不一致`,
          detail: `标题左侧 ${Math.round(entry.x / 12700)}pt，主流参考线 ${Math.round(refLine / 12700)}pt，偏差 ${Math.round(Math.abs(entry.x - refLine) / 12700)}pt`,
          actual: `左侧位置：${Math.round(entry.x / 12700)}pt`,
          expected: `左侧位置：${Math.round(refLine / 12700)}pt`,
          source: '内置规则集 builtin-rules-v1.0',
          reason: `同类标题 ${entries.length} 个，参考线为 ${Math.round(refLine / 12700)}pt，当前偏差 ${Math.round(Math.abs(entry.x - refLine) / 12700)}pt`,
          suggestion: `建议将标题左侧对齐至 ${Math.round(refLine / 12700)}pt`,
          fixable: true,
          status: '待处理',
          fixData: {
            page: entry.page - 1,
            x: Math.round(refLine),
          },
        });
      }
    }
  }

  return issues;
}

/**
 * 在位置集合中找出满足 ≥70% 样本偏差 ≤ tolerance 的参考线值。
 * @param {Array<{x: number}>} entries
 * @param {number} tolerance EMU
 * @returns {number|null} 参考线值（EMU），无法形成时返回 null
 */
function findReferenceLine(entries, tolerance) {
  const n = entries.length;
  const THRESHOLD = Math.ceil(n * 0.7); // ≥70%

  // 尝试每个位置作为参考线候选
  for (const candidate of entries) {
    const center = candidate.x;
    const count = entries.filter(e => Math.abs(e.x - center) <= tolerance).length;
    if (count >= THRESHOLD) {
      // 取所有在容差内的位置的平均值作为参考线
      const inRange = entries.filter(e => Math.abs(e.x - center) <= tolerance);
      const avg = inRange.reduce((s, e) => s + e.x, 0) / inRange.length;
      return avg;
    }
  }

  return null;
}

export function check(slide, presInfo) {
  return checkStyle(slide, presInfo);
}

export function checkCrossPage(allSlides, presInfo) {
  return checkPosition(allSlides, presInfo);
}
