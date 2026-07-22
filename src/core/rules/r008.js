/**
 * R008 文字安全边距检查
 *
 * 文字可见边界距离页面边缘小于页面宽度/高度的 3% 时 → S3。
 * 仅检查文本框、含文字形状；图片、页码、页脚、母版文字不检查。
 * 不支持自动修复。
 */
export const rule = {
  id: 'R008',
  name: '文字安全边距检查',
  level: 's3',
  fixable: false,
  pageLevel: true,
  crossPage: false,
};

/**
 * @param {Object} slide
 * @param {Object} presInfo
 */
export function check(slide, presInfo) {
  const issues = [];
  const { texts, page } = slide;
  const pw = presInfo.width || 12192000;
  const ph = presInfo.height || 6858000;
  const marginX = pw * 0.03;
  const marginY = ph * 0.03;

  for (const t of texts) {
    // 排除页脚、页码（phType 为 ftr/sldNum）
    if (t.phType === 'ftr' || t.phType === 'sldNum') continue;

    const left = t.x;
    const right = pw - (t.x + t.w);
    const top = t.y;
    const bottom = ph - (t.y + t.h);

    const violations = [];
    if (left < marginX) violations.push(`左 ${Math.round(left / 12700)}pt < ${Math.round(marginX / 12700)}pt`);
    if (right < marginX) violations.push(`右 ${Math.round(right / 12700)}pt < ${Math.round(marginX / 12700)}pt`);
    if (top < marginY) violations.push(`上 ${Math.round(top / 12700)}pt < ${Math.round(marginY / 12700)}pt`);
    if (bottom < marginY) violations.push(`下 ${Math.round(bottom / 12700)}pt < ${Math.round(marginY / 12700)}pt`);

    if (violations.length > 0) {
      issues.push({
        rule: 'R008',
        type: '文字安全边距',
        level: 's3',
        page,
        object: `文本框`,
        desc: `第 ${page} 页文字距页面边缘过近（${violations.join('，')}）`,
        detail: `文本"${(t.text || '').slice(0, 30)}"的文本框位置 (${Math.round(t.x / 12700)}, ${Math.round(t.y / 12700)})pt，尺寸 ${Math.round(t.w / 12700)}×${Math.round(t.h / 12700)}pt，${violations.join('，')}`,
        actual: `边距：${violations.join('，')}`,
        expected: `各边距 ≥ ${Math.round(marginX / 12700)}pt`,
        source: '内置规则集 builtin-rules-v1.0',
        reason: `文字实际边界进入页面边缘 ${Math.round(marginX / 12700)}pt 安全区域`,
        suggestion: '建议将文字向内移动或缩小文本框',
        fixable: false,
        status: '待处理',
      });
    }
  }

  return issues;
}
