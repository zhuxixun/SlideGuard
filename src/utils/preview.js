/**
 * 幻灯片预览渲染
 *
 * 将提取的文本/形状位置数据转换为可视化 HTML。
 * 坐标系：EMU → px，支持 16:9 / 4:3 比例。
 */

/**
 * 渲染单页幻灯片预览 HTML
 * @param {Object} slide - { page, texts: [...], shapes: [...] }
 * @param {Object} presInfo - { width, height } 单位 EMU
 * @param {number} previewWidth - 预览区像素宽度
 * @param {number|null} highlightIdx - 要高亮的文本元素索引（红框）
 * @param {Array} refPositions - 参考对象位置 [{x,y,w,h}] EMU（蓝框）
 * @param {Object|null} alignLine - 参考线 {dim, value} 如 {dim:'left', value:500000}
 * @returns {string} 预览 HTML
 */
export function renderSlidePreview(slide, presInfo, previewWidth, highlightIdx, refPositions, alignLine) {
  const sw = presInfo.width || 12192000;
  const sh = presInfo.height || 6858000;
  const scale = previewWidth / sw;
  const previewHeight = Math.round(sh * scale);

  const texts = (slide.texts || []).filter(t => {
    // 过滤掉过小的元素（缩略图级别的不显示）
    return (t.w * scale) > 3 && (t.h * scale) > 3;
  });
  const shapes = (slide.shapes || []).filter(s => {
    return (s.w * scale) > 5 && (s.h * scale) > 5;
  });

  // 限制数量防止性能问题
  const maxTexts = 40;
  const maxShapes = 20;
  const filteredTexts = texts.slice(0, maxTexts);
  const filteredShapes = shapes.slice(0, maxShapes);

  // 判断元素是否匹配参考位置（用于对齐问题蓝框）
  const isRef = (elem, refs) => {
    if (!refs || refs.length === 0) return false;
    const tolerance = 3 * 12700;
    return refs.some(r =>
      Math.abs(elem.x - r.x) <= tolerance &&
      Math.abs(elem.y - r.y) <= tolerance &&
      Math.abs(elem.w - r.w) <= tolerance
    );
  };

  // 构建文本元素 HTML
  const textEls = filteredTexts.map((t, i) => {
    const isHighlight = i === highlightIdx;
    const isRefMatch = !isHighlight && isRef(t, refPositions);
    let borderColor = 'transparent';
    let bgColor = 'transparent';
    let shadow = '';
    let zIdx = 1;
    if (isHighlight) {
      borderColor = '#e5484d';
      bgColor = 'rgba(229,72,77,0.08)';
      shadow = 'box-shadow:0 0 0 2px rgba(229,72,77,0.25);';
      zIdx = 10;
    } else if (isRefMatch) {
      borderColor = '#3f8cff';
      bgColor = 'rgba(63,140,255,0.06)';
      shadow = 'box-shadow:0 0 0 1px rgba(63,140,255,0.2);';
      zIdx = 5;
    }
    return `<div style="
      position:absolute;
      left:${Math.round(t.x * scale)}px;
      top:${Math.round(t.y * scale)}px;
      width:${Math.round(t.w * scale)}px;
      height:${Math.round(t.h * scale)}px;
      font-size:${calcFontSize(t.fontSize, sw, previewWidth)}px;
      font-family:${t.fontName || '微软雅黑'},sans-serif;
      font-weight:${t.bold ? 'bold' : 'normal'};
      color:${t.color ? '#' + t.color : '#333'};
      overflow:hidden;
      word-break:break-all;
      background:${bgColor};
      border:2px solid ${borderColor};
      border-radius:3px;
      box-sizing:border-box;
      padding:2px;
      z-index:${zIdx};
      ${shadow}
    " title="${escapeAttr(t.text)}">${escapeHtml(truncateText(t.text, 200))}</div>`;
  }).join('');

  // 构建形状元素 HTML（简化为色块）
  const shapeEls = filteredShapes.map(s => {
    const isRefMatch = isRef(s, refPositions);
    const border = isRefMatch ? '2px solid #3f8cff' : '1px solid rgba(31,94,255,0.15)';
    const bg = isRefMatch ? 'rgba(63,140,255,0.08)' : 'rgba(31,94,255,0.06)';
    return `<div style="
      position:absolute;
      left:${Math.round(s.x * scale)}px;
      top:${Math.round(s.y * scale)}px;
      width:${Math.round(s.w * scale)}px;
      height:${Math.round(s.h * scale)}px;
      background:${bg};
      border:${border};
      border-radius:2px;
      box-sizing:border-box;
      z-index:${isRefMatch ? 5 : 0};
      pointer-events:none;
    " title="形状: ${escapeAttr(s.name || '')}"></div>`;
  }).join('');

  // 参考线（对齐问题用）
  let lineHtml = '';
  if (alignLine && refPositions && refPositions.length > 0) {
    const lv = alignLine.value * scale;
    const dim = alignLine.dim;
    if (dim === 'left' || dim === 'right' || dim === 'hCenter') {
      // 竖线
      lineHtml = `<div style="
        position:absolute;
        left:${Math.round(lv)}px;
        top:0;
        width:2px;
        height:${previewHeight}px;
        background:#3f8cff;
        opacity:0.5;
        z-index:15;
        pointer-events:none;
      "></div>`;
    } else if (dim === 'top' || dim === 'bottom' || dim === 'vCenter') {
      // 横线
      lineHtml = `<div style="
        position:absolute;
        left:0;
        top:${Math.round(lv)}px;
        width:${previewWidth}px;
        height:2px;
        background:#3f8cff;
        opacity:0.5;
        z-index:15;
        pointer-events:none;
      "></div>`;
    }
  }

  return `<div style="
    position:relative;
    width:${previewWidth}px;
    height:${previewHeight}px;
    background:#fff;
    border:1px solid #cfd7e3;
    box-shadow:0 2px 8px rgba(36,53,84,0.08);
    overflow:hidden;
    margin:auto;
  ">${textEls}${shapeEls}${lineHtml}</div>`;
}

/**
 * 渲染缩略图 HTML（更小的尺寸）
 */
export function renderThumbnail(slide, presInfo, thumbWidth, isActive) {
  const sw = presInfo.width || 12192000;
  const sh = presInfo.height || 6858000;
  const scale = thumbWidth / sw;
  const thumbHeight = Math.round(sh * scale);
  const texts = (slide.texts || []).filter(t => (t.w * scale) > 5 && (t.h * scale) > 5);
  const textEls = texts.slice(0, 5).map(t => {
    const fs = Math.max(7, calcFontSize(t.fontSize, sw, thumbWidth));
    return `<div style="
      position:absolute;
      left:${Math.round(Math.max(0, t.x * scale))}px;
      top:${Math.round(Math.max(0, t.y * scale))}px;
      width:${Math.round(Math.min(t.w * scale, thumbWidth * 0.9))}px;
      height:${Math.round(Math.min(t.h * scale, thumbHeight * 0.3))}px;
      font-size:${fs}px;
      color:#333;
      overflow:hidden;
      white-space:nowrap;
      text-overflow:ellipsis;
      line-height:1.2;
    ">${escapeHtml(t.text.slice(0, 20))}</div>`;
  }).join('');

  return `<div style="
    position:relative;
    width:${thumbWidth}px;
    height:${thumbHeight}px;
    background:linear-gradient(145deg,#165ddd 0 ${Math.round(22/thumbHeight*100)}%, #fff ${Math.round(22/thumbHeight*100)}%);
    box-shadow:inset 0 0 0 1px #ccd5e3;
    overflow:hidden;
    cursor:pointer;
    ${isActive ? 'outline:2px solid #1f5eff;outline-offset:-2px;' : ''}
  ">${textEls}</div>`;
}

/**
 * 根据问题描述在 slide 中定位对应的文本元素
 * @returns {number} 文本元素索引，-1 表示未找到
 */
export function findHighlightIndex(slide, issue) {
  if (!slide || !issue) return -1;
  const texts = slide.texts || [];
  if (texts.length === 0) return -1;

  // 优先 shapeId 匹配
  if (issue.fixData?.shapeId) {
    const idx = texts.findIndex(t => String(t.shapeId) === String(issue.fixData.shapeId));
    if (idx >= 0) return idx;
  }

  // 文本内容包含匹配
  const desc = issue.desc || '';
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i].text || '';
    if (t.length > 3 && desc.includes(t.slice(0, 20))) return i;
  }

  // 类型匹配 — 标题问题找标题
  if (issue.rule === 'R009' && issue.type === '标题一致性') {
    const idx = texts.findIndex(t => t.isTitle);
    if (idx >= 0) return idx;
  }

  // 字体匹配
  if (issue.rule === 'R004') {
    const fontName = issue.actual?.replace('字体：', '')?.trim();
    if (fontName) {
      const idx = texts.findIndex(t => t.fontName === fontName);
      if (idx >= 0) return idx;
    }
  }

  // 对齐问题（R007）：按位置匹配
  if (issue.rule === 'R007' && issue.actual) {
    const ptMatch = issue.actual.match(/(\d+(?:\.\d+)?)\s*pt/);
    if (ptMatch) {
      const targetPt = parseFloat(ptMatch[1]);
      const targetEmu = targetPt * 12700;
      const tolerance = 3 * 12700;
      // 从 actual 判断维度
      const dim = issue.alignDim || (issue.actual.includes('left') ? 'left' : issue.actual.includes('top') ? 'top' : null);
      if (dim === 'left' || dim === 'right') {
        const idx = texts.findIndex(t => Math.abs(t.x - targetEmu) <= tolerance);
        if (idx >= 0) return idx;
        // 如果没匹配到 text，检查形状的 x
      } else if (dim === 'top' || dim === 'bottom') {
        const idx = texts.findIndex(t => Math.abs(t.y - targetEmu) <= tolerance);
        if (idx >= 0) return idx;
      }
    }
  }

  return -1;
}

/* ── 辅助函数 ── */

function calcFontSize(fontSizePt, slideWidthEmu, previewWidthPx) {
  if (!fontSizePt) return 11;
  return Math.max(6, fontSizePt * previewWidthPx * 12700 / slideWidthEmu);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(String(s)).replace(/"/g, '&quot;');
}

function truncateText(s, max) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}
