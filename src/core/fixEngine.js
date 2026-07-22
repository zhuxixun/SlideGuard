/**
 * 自动修复引擎
 *
 * 在内存中修改 PPTX ZIP 中的 XML，生成新的 .pptx 并通过浏览器下载。
 * 支持修复规则：R004（字体）、R005（字号）、R007（对齐）、R009（标题样式）
 *
 * 流程：
 *   1. 从 ArrayBuffer 加载 ZIP
 *   2. 对每个可修复问题，修改对应幻灯片 XML
 *   3. 重新生成 ZIP 并验证
 *   4. 触发浏览器下载
 */
import JSZip from 'jszip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { store } from '../store.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: false,
  suppressEmptyNode: true,
});

/**
 * 执行修复
 * @param {ArrayBuffer} pptxData 原始文件
 * @param {Array} issues 要修复的问题列表（每个必须含 fixable:true）
 * @returns {Promise<{buffer: ArrayBuffer|null, fixed: number, failed: number, errors: string[]}>}
 */
export async function fixIssues(pptxData, issues) {
  const fixable = issues.filter(i => i.fixable);
  let fixed = 0;
  let failed = 0;
  const errors = [];

  if (fixable.length === 0) {
    return { buffer: null, fixed: 0, failed: 0, errors: ['没有可修复的问题'] };
  }

  // 加载 ZIP
  let zip;
  try {
    zip = await JSZip.loadAsync(pptxData);
  } catch (e) {
    return { buffer: null, fixed: 0, failed: 0, errors: ['无法解析 PPTX 文件: ' + e.message] };
  }

  // 按页分组修复操作
  const pageFixes = {};
  for (const issue of fixable) {
    const page = issue.page || 1;
    if (!pageFixes[page]) pageFixes[page] = [];
    pageFixes[page].push(issue);
  }

  // 逐页应用修复
  for (const [pageStr, pageIssues] of Object.entries(pageFixes)) {
    const pageIdx = parseInt(pageStr) - 1;
    const slidePath = `ppt/slides/slide${pageIdx + 1}.xml`;
    const slideFile = zip.file(slidePath);

    if (!slideFile) {
      for (const iss of pageIssues) {
        failed++;
        errors.push(`${iss.rule || 'R???'}: 第 ${pageStr} 页幻灯片文件缺失`);
        iss.status = '修复失败';
      }
      continue;
    }

    try {
      const xmlStr = await slideFile.async('text');
      const xmlObj = parser.parse(xmlStr);
      let modified = false;

      for (const issue of pageIssues) {
        try {
          const applied = applyFix(xmlObj, issue);
          if (applied) {
            fixed++;
            modified = true;
            issue.status = '已修复';
          } else {
            failed++;
            errors.push(`${issue.rule || 'R???'}: 第 ${pageStr} 页未找到目标对象`);
            issue.status = '修复失败';
          }
        } catch (e) {
          failed++;
          errors.push(`${issue.rule || 'R???'}: 第 ${pageStr} 页修复失败: ${e.message}`);
          issue.status = '修复失败';
        }
      }

      if (modified) {
        const newXml = builder.build(xmlObj);
        // 恢复 XML 声明
        zip.file(slidePath, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + newXml);
      }
    } catch (e) {
      for (const iss of pageIssues) {
        failed++;
        errors.push(`${iss.rule || 'R???'}: 第 ${pageStr} 页处理失败: ${e.message}`);
        iss.status = '修复失败';
      }
    }
  }

  // 生成新 ZIP
  let buffer = null;
  try {
    buffer = await zip.generateAsync({ type: 'arraybuffer' });
    // 验证 ZIP 结构
    const verifyZip = await JSZip.loadAsync(buffer);
    const verifyFiles = verifyZip.file(/./);
    if (verifyFiles.length === 0) {
      buffer = null;
      errors.push('验证失败：生成的 ZIP 文件为空');
    }
  } catch (e) {
    buffer = null;
    errors.push('ZIP 生成失败: ' + e.message);
  }

  return { buffer, fixed, failed, errors };
}

/**
 * 在解析后的 XML 对象上应用单条修复
 */
function applyFix(xmlObj, issue) {
  const slide = xmlObj['p:sld'] || xmlObj['sld'] || xmlObj;
  const spTree = slide['p:cSld']?.['p:spTree'] || slide['cSld']?.['spTree'] || {};
  const shapes = spTree['p:sp'] || spTree['sp'] || [];
  const shapeList = Array.isArray(shapes) ? shapes : [shapes];

  for (const sp of shapeList) {
    if (!sp) continue;

    // 用 shapeId 或近似内容匹配
    const nvSpPr = sp['p:nvSpPr'] || sp['nvSpPr'] || {};
    const spId = sp['@_id'] || nvSpPr['p:cNvPr']?.['@_id'] || nvSpPr['cNvPr']?.['@_id'];
    const matchesId = issue.fixData && issue.fixData.shapeId && String(spId) === String(issue.fixData.shapeId);

    // 内容匹配（备用）
    let matchesText = false;
    if (!matchesId) {
      const txBody = sp['p:txBody'] || sp['txBody'];
      if (txBody && issue.fixData?.textContent) {
        const textContent = extractTextFromShape(sp).replace(/\n/g, '');
        const targetText = issue.fixData.textContent.replace(/\n/g, '');
        if (textContent && textContent === targetText) {
          matchesText = true;
        }
      }
    }

    // 位置匹配（最后备用）
    let matchesPosition = false;
    if (!matchesId && !matchesText && issue.fixData?.x != null && issue.fixData?.y != null) {
      const spPr = sp['p:spPr'] || sp['spPr'] || {};
      const xfrm = spPr['a:xfrm'] || spPr['xfrm'] || {};
      const off = xfrm['a:off'] || xfrm['off'] || {};
      const sx = parseFloat(off['@_x']) || 0;
      const sy = parseFloat(off['@_y']) || 0;
      const tolerance = 12700; // 1pt
      if (Math.abs(sx - issue.fixData.x) <= tolerance && Math.abs(sy - issue.fixData.y) <= tolerance) {
        matchesPosition = true;
      }
    }

    if (!matchesId && !matchesText && !matchesPosition) continue;

    // 根据规则类型应用修复
    switch (issue.rule) {
      case 'R004': return fixFont(sp, issue);
      case 'R005': return fixFontSize(sp, issue);
      case 'R007': return fixPosition(sp, issue);
      case 'R009': return fixTitle(sp, issue);
      default: return false;
    }
  }

  return false;
}

function extractTextFromShape(sp) {
  const txBody = sp['p:txBody'] || sp['txBody'] || {};
  const paragraphs = txBody['a:p'] || [];
  const pars = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  let text = '';
  for (const p of pars) {
    const runs = p['a:r'] || [];
    const runList = Array.isArray(runs) ? runs : [runs];
    for (const r of runList) {
      text += r['a:t']?.['#text'] ?? r['a:t'] ?? '';
    }
  }
  return text.trim();
}

/**
 * R004: 替换字体为微软雅黑
 */
function fixFont(sp, issue) {
  const txBody = sp['p:txBody'] || sp['txBody'];
  if (!txBody) return false;

  // 如果有 fixData 中的 targetFont
  const targetFont = issue.fixData?.targetFont || '微软雅黑';
  const paragraphs = txBody['a:p'] || [];
  const pars = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  let changed = false;

  const setFontProps = (rPr) => {
    if (!rPr) return false;
    let mod = false;
    if (rPr['@_typeface'] && !isStandardFont(rPr['@_typeface'])) {
      rPr['@_typeface'] = targetFont;
      mod = true;
    }
    const latin = rPr['a:latin'];
    if (latin && latin['@_typeface'] && !isStandardFont(latin['@_typeface'])) {
      latin['@_typeface'] = targetFont;
      mod = true;
    }
    const ea = rPr['a:ea'];
    if (ea && ea['@_typeface'] && !isStandardFont(ea['@_typeface'])) {
      ea['@_typeface'] = targetFont;
      mod = true;
    }
    return mod;
  };

  for (const p of pars) {
    // 段落默认字体
    const pPr = p['a:pPr'];
    if (pPr) {
      const defRPr = pPr['a:defRPr'];
      if (defRPr && setFontProps(defRPr)) changed = true;
    }

    // 文本级 run 字体
    const runs = p['a:r'] || [];
    const runList = Array.isArray(runs) ? runs : [runs];
    for (const r of runList) {
      const rPr = r['a:rPr'];
      if (rPr && setFontProps(rPr)) changed = true;
    }
  }

  return changed;
}

/**
 * R005: 调整字号
 */
function fixFontSize(sp, issue) {
  const targetSize = parseTargetSize(issue);
  if (!targetSize) return false;

  const txBody = sp['p:txBody'] || sp['txBody'];
  if (!txBody) return false;

  const paragraphs = txBody['a:p'] || [];
  const pars = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  let changed = false;

  for (const p of pars) {
    const pPr = p['a:pPr'];
    if (pPr) {
      const defRPr = pPr['a:defRPr'];
      if (defRPr && defRPr['@_sz'] && parseFloat(defRPr['@_sz']) !== targetSize * 100) {
        defRPr['@_sz'] = targetSize * 100;
        changed = true;
      }
    }

    const runs = p['a:r'] || [];
    const runList = Array.isArray(runs) ? runs : [runs];
    for (const r of runList) {
      const rPr = r['a:rPr'];
      if (rPr && rPr['@_sz']) {
        const current = parseFloat(rPr['@_sz']);
        if (Math.abs(current - targetSize * 100) > 2 * 100) { // 偏差 > 2pt
          rPr['@_sz'] = targetSize * 100;
          changed = true;
        }
      }
    }
  }

  return changed;
}

function parseTargetSize(issue) {
  // 从 expected 字段提取，如 "14pt" 或 "14"
  const m = String(issue.expected || '').match(/(\d+(?:\.\d+)?)\s*pt/);
  if (m) return parseFloat(m[1]);
  // 从 suggestion 提取
  const m2 = String(issue.suggestion || '').match(/(\d+(?:\.\d+)?)\s*pt/);
  if (m2) return parseFloat(m2[1]);
  return null;
}

/**
 * R007: 对齐修复—调整位置
 */
function fixPosition(sp, issue) {
  const spPr = sp['p:spPr'] || sp['spPr'];
  if (!spPr) return false;

  const xfrm = spPr['a:xfrm'] || spPr['xfrm'];
  if (!xfrm) return false;

  const off = xfrm['a:off'] || xfrm['off'];
  if (!off) return false;

  // 从 expected 中解析目标坐标，格式如 "left: 100pt" 或 "100pt"
  const expected = issue.expected || '';
  const m = expected.match(/(?:left|right|top|bottom|hCenter|vCenter)?:?\s*(\d+(?:\.\d+)?)\s*pt/i);
  if (!m) return false;

  const targetPt = parseFloat(m[1]);
  const targetEmu = Math.round(targetPt * 12700);

  if (expected.includes('left') || expected.includes('Left')) {
    off['@_x'] = targetEmu;
    return true;
  }
  if (expected.includes('top') || expected.includes('Top')) {
    off['@_y'] = targetEmu;
    return true;
  }

  // 默认：根据 actual/expected 的上下文判断是 x 还是 y
  const actual = issue.actual || '';
  if (actual.includes('left') || actual.includes('x') || actual.toLowerCase().includes('left')) {
    off['@_x'] = targetEmu;
  } else {
    off['@_y'] = targetEmu;
  }
  return true;
}

/**
 * R009: 标题样式修复（含超长标题冒号分割）
 */
function fixTitle(sp, issue) {
  // 超长标题冒号分割修复
  if (issue.fixData?.type === 'title-overflow') {
    return fixTitleOverflow(sp, issue);
  }

  // 标准样式修复
  const txBody = sp['p:txBody'] || sp['txBody'];
  if (!txBody) return false;

  let changed = false;
  const paragraphs = txBody['a:p'] || [];
  const pars = Array.isArray(paragraphs) ? paragraphs : [paragraphs];

  for (const p of pars) {
    const runs = p['a:r'] || [];
    const runList = Array.isArray(runs) ? runs : [runs];

    for (const r of runList) {
      const rPr = r['a:rPr'] || (r['rPr']);
      if (!rPr) continue;

      // 字体
      if (issue.level === 's1' && (issue.desc.includes('字体') || issue.desc.includes('颜色'))) {
        if (issue.desc.includes('字体')) {
          setFontToStandard(rPr);
          changed = true;
        }
        if (issue.desc.includes('颜色')) {
          setColorToStandard(rPr);
          changed = true;
        }
      }

      // 字号、加粗
      if (rPr['@_sz'] && parseFloat(rPr['@_sz']) !== 2400) { // 24pt = 2400 hundredths
        rPr['@_sz'] = 2400;
        changed = true;
      }
      if (rPr['@_b'] !== '1') {
        rPr['@_b'] = '1';
        changed = true;
      }
    }
  }

  return changed;
}

/**
 * R009 超长标题：在冒号处分割文本，后半部分缩小字号
 */
function fixTitleOverflow(sp, issue) {
  const fd = issue.fixData;
  if (!fd || !fd.textBefore || !fd.textAfter) return false;
  const targetSize = fd.targetSizeAfter || 14;
  const colonChar = fd.textBefore.slice(-1); // 冒号字符

  const txBody = sp['p:txBody'] || sp['txBody'];
  if (!txBody) return false;

  const paragraphs = txBody['a:p'] || [];
  const pars = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  let changed = false;

  for (const p of pars) {
    const runs = p['a:r'] || [];
    const runList = Array.isArray(runs) ? runs : [];

    // 重建 runs：在冒号处分割
    const newRuns = [];
    let colonFound = false;

    for (const r of runList) {
      if (!r) continue;
      const text = r['a:t']?.['#text'] ?? r['a:t'] ?? '';
      const rPr = r['a:rPr'] || {};

      if (!colonFound && text.includes('：') || text.includes(':')) {
        // 找到包含冒号的 run
        const colonIdx = findColonInText(text);
        if (colonIdx >= 0) {
          const beforeText = text.slice(0, colonIdx + 1);
          const afterText = text.slice(colonIdx + 1);

          // 克隆前半部分 run（保持原有格式）
          if (beforeText) {
            const beforeRun = cloneRun(r, beforeText);
            if (rPr['@_sz'] && parseFloat(rPr['@_sz']) !== 2400) {
              if (!beforeRun['a:rPr']) beforeRun['a:rPr'] = { ...rPr };
              beforeRun['a:rPr']['@_sz'] = 2400;
            }
            newRuns.push(beforeRun);
          }

          // 后半部分 run（缩小字号）
          if (afterText) {
            const afterRun = cloneRun(r, afterText);
            // 确保有 rPr
            if (!afterRun['a:rPr']) afterRun['a:rPr'] = { ...rPr };
            afterRun['a:rPr']['@_sz'] = targetSize * 100;
            newRuns.push(afterRun);
          }

          colonFound = true;
          changed = true;
        } else {
          newRuns.push(r);
        }
      } else if (colonFound) {
        // 冒号之后的 runs：全部缩小字号
        const cloned = cloneRun(r, text);
        if (!cloned['a:rPr']) cloned['a:rPr'] = { ...rPr };
        cloned['a:rPr']['@_sz'] = targetSize * 100;
        newRuns.push(cloned);
        changed = true;
      } else {
        newRuns.push(r);
      }
    }

    if (changed) {
      p['a:r'] = newRuns;
    }
  }

  return changed;
}

/** 在文本中找到第一个冒号位置 */
function findColonInText(text) {
  const cn = text.indexOf('：');
  const en = text.indexOf(':');
  if (cn >= 0 && en >= 0) return Math.min(cn, en);
  return cn >= 0 ? cn : en;
}

/** 克隆一个 run 并替换文本 */
function cloneRun(original, newText) {
  const clone = JSON.parse(JSON.stringify(original));
  if (clone['a:t'] !== undefined) {
    clone['a:t'] = newText;
  } else if (clone['a:t']?.['#text'] !== undefined) {
    clone['a:t'] = { '#text': newText };
  }
  return clone;
}

function isStandardFont(name) {
  if (!name) return false;
  const n = name.trim();
  return n === '微软雅黑' || n === 'Microsoft YaHei' || n === 'Microsoft YaHei UI';
}

function setFontToStandard(rPr) {
  if (rPr['@_typeface']) rPr['@_typeface'] = '微软雅黑';
  if (rPr['a:latin']) rPr['a:latin']['@_typeface'] = '微软雅黑';
  if (rPr['a:ea']) rPr['a:ea']['@_typeface'] = '微软雅黑';
}

function setColorToStandard(rPr) {
  const solidFill = rPr['a:solidFill'];
  if (solidFill) {
    const srgbClr = solidFill['a:srgbClr'];
    if (srgbClr) {
      srgbClr['@_val'] = 'C00000';
    } else {
      solidFill['a:srgbClr'] = { '@_val': 'C00000' };
    }
  } else {
    rPr['a:solidFill'] = { 'a:srgbClr': { '@_val': 'C00000' } };
  }
}

/**
 * 下载修复后的文件
 */
export function downloadFixedFile(buffer, originalName) {
  const baseName = originalName ? originalName.replace(/\.pptx$/i, '') : 'presentation';
  const now = new Date();
  const ts = String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const fileName = `${baseName}_SlideGuard_fixed_${ts}.pptx`;

  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return fileName;
}
