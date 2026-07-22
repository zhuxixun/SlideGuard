/**
 * R007 元素对齐检查
 *
 * 至少 3 个类型相同、尺寸近似、呈规律排列的对象。
 * 70% 样本对齐形成参考线，偏离 > 3pt → S3。
 * 支持自动修复（移动位置）。
 */
export const rule = {
  id: 'R007',
  name: '元素对齐检查',
  level: 's3',
  fixable: true,
  pageLevel: true,
  crossPage: false,
};

const ALIGN_DIMS = ['left', 'right', 'top', 'bottom', 'hCenter', 'vCenter'];

function getDimValue(elem, dim) {
  switch (dim) {
    case 'left': return elem.x;
    case 'right': return elem.x + elem.w;
    case 'top': return elem.y;
    case 'bottom': return elem.y + elem.h;
    case 'hCenter': return elem.x + elem.w / 2;
    case 'vCenter': return elem.y + elem.h / 2;
    default: return 0;
  }
}

/**
 * @param {Object} slide
 * @param {Object} presInfo
 */
export function check(slide, presInfo) {
  const issues = [];
  const { texts, shapes, page } = slide;

  // 合并所有元素，用类型分组
  const allElems = [
    ...texts.map(t => ({ ...t, _type: 'text' })),
    ...shapes.map(s => ({ ...s, _type: s.type })),
  ];

  if (allElems.length < 3) return issues;

  // 按类型分组
  const groups = {};
  for (const e of allElems) {
    const key = e._type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  for (const [type, elems] of Object.entries(groups)) {
    // 水平排列：top 或 bottom 相近
    // 垂直排列：left 或 right 相近
    if (elems.length < 3) continue;

    // 检查水平排列（y 相近）
    const hCandidates = elems.filter(e => e.h && e.h > 0);
    if (hCandidates.length >= 3) {
      const yVals = hCandidates.map(e => e.y);
      const tolerance = 3 * 12700; // 3pt in EMU

      // 聚类 y 值：相近的归为一组
      const cluster = clusterValues(yVals, tolerance);
      if (cluster && cluster.length >= 3) {
        // 这些元素在 y 上对齐 → 检查水平对齐
        const aligned = cluster.indices.map(i => hCandidates[i]);
        checkAlignment(aligned, issues, page, '水平');
      }
    }

    // 检查垂直排列（x 相近）
    const vCandidates = elems.filter(e => e.w && e.w > 0);
    if (vCandidates.length >= 3) {
      const xVals = vCandidates.map(e => e.x);
      const tolerance = 3 * 12700;
      const cluster = clusterValues(xVals, tolerance);
      if (cluster && cluster.length >= 3) {
        const aligned = cluster.indices.map(i => vCandidates[i]);
        checkAlignment(aligned, issues, page, '垂直');
      }
    }
  }

  return issues;
}

/**
 * 对数值进行聚类：找到最大的相近分组
 */
function clusterValues(vals, tolerance) {
  const n = vals.length;
  let best = { indices: [], length: 0 };

  for (let i = 0; i < n; i++) {
    const group = { indices: [i], mean: vals[i] };
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (Math.abs(vals[j] - vals[i]) <= tolerance) {
        group.indices.push(j);
      }
    }
    if (group.indices.length > best.length) {
      best = group;
    }
  }

  return best.length >= 3 ? best : null;
}

/**
 * 检查同一行/列中元素的左右/上下对齐
 */
function checkAlignment(elems, issues, page, direction) {
  // 对每个对齐维度检查
  for (const dim of (direction === '水平' ? ['left', 'right', 'hCenter'] : ['top', 'bottom', 'vCenter'])) {
    const vals = elems.map(e => getDimValue(e, dim));
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const tolerance = 3 * 12700;

    // 至少 70% 在容差内
    const alignedVals = vals.filter(v => Math.abs(v - avg) <= tolerance);
    if (alignedVals.length / vals.length >= 0.7) {
      // 收集参考元素的位置数据（用于预览高亮）
      const refPositions = [];
      for (let j = 0; j < elems.length; j++) {
        if (Math.abs(vals[j] - avg) <= tolerance) {
          const ref = elems[j];
          refPositions.push({ x: ref.x, y: ref.y, w: ref.w, h: ref.h });
        }
      }

      // 检查偏离的
      for (let i = 0; i < elems.length; i++) {
        if (Math.abs(vals[i] - avg) > tolerance) {
          const e = elems[i];
          issues.push({
            rule: 'R007',
            type: '元素对齐',
            level: 's3',
            page,
            object: e._type === 'text' ? '文本框' : (e.name || '形状'),
            desc: `第 ${page} 页元素 ${{left:'左',right:'右',top:'上',bottom:'下',hCenter:'水平中心',vCenter:'垂直中心'}[dim]} 对齐偏离参考线`,
            detail: `${direction}排列元素中，此元素${dim}对齐偏差 ${Math.round(Math.abs(vals[i] - avg) / 12700)}pt，超过 3pt 容差`,
            actual: `${dim}: ${Math.round(vals[i] / 12700)}pt`,
            expected: `${dim}: ${Math.round(avg / 12700)}pt`,
            source: '内置规则集 builtin-rules-v1.0',
            reason: `同类 ${direction}排列元素 ${elems.length} 个，${Math.round(alignedVals.length / vals.length * 100)}% 元素已对齐，偏差 ${Math.round(Math.abs(vals[i] - avg) / 12700)}pt`,
            suggestion: `建议将元素${dim}对齐至 ${Math.round(avg / 12700)}pt`,
            fixable: true,
            status: '待处理',
            // 参考对象位置数据（用于预览高亮）
            refPositions: refPositions.slice(0, 6),
            alignDim: dim,
            alignValue: Math.round(avg),
          });
        }
      }
    }
  }
}
