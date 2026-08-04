/**
 * PPTX 解析器
 *
 * .pptx = ZIP 包内含 OOXML
 * 关键文件：
 *   [Content_Types].xml
 *   ppt/presentation.xml       — 幻灯片尺寸、幻灯片列表
 *   ppt/slides/slideN.xml      — 每页内容
 *   ppt/slidesMasters/         — 母版
 *   ppt/slideLayouts/          — 版式
 *   ppt/media/                 — 图片
 */
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseNumbers: false,
});

/**
 * Read an OOXML bold value without confusing an absent attribute (inherit)
 * with an explicit false value.
 * @returns {boolean|null} null means that this level does not specify bold.
 */
function readBold(rPr) {
  if (!rPr || !Object.prototype.hasOwnProperty.call(rPr, '@_b')) return null;
  const value = rPr['@_b'];
  return value === '1' || value === 1 || value === true || value === 'true' || value === 'on';
}

function mergeBold(current, value) {
  // A title is compliant only when every resolved run is bold.
  if (current === false || value === false) return false;
  if (current === true || value === true) return true;
  return null;
}

/**
 * 解析 PPTX 文件，提取基本元数据
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{slideCount, width, height, slideNames, zip}>}
 */
export async function parsePptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  // 解析 presentation.xml 获取幻灯片列表和页面尺寸
  const presFile = zip.file('ppt/presentation.xml');
  if (!presFile) throw new Error('无法找到 presentation.xml，文件可能不是有效的 PPTX');

  const presXml = await presFile.async('text');
  const pres = parser.parse(presXml);

  // OOXML 命名空间包装
  const presentation = pres['p:presentation'] || pres['Presentation'] || pres;
  const sldSz = presentation['p:sldSz'] || {};
  const width = parseFloat(sldSz['@_cx']) || 12192000;   // EMU
  const height = parseFloat(sldSz['@_cy']) || 6858000;

  // 获取幻灯片 ID 列表
  const sldIdLst = presentation['p:sldIdLst'] || {};
  const sldIds = sldIdLst['p:sldId'];
  const slideEntries = Array.isArray(sldIds) ? sldIds : (sldIds ? [sldIds] : []);
  const slideCount = slideEntries.length;

  // 收集幻灯片文件名（用于按需加载）
  const slideNames = [];
  for (let i = 0; i < slideCount; i++) {
    slideNames.push(`ppt/slides/slide${i + 1}.xml`);
  }

  return {
    slideCount,
    width,          // EMU
    height,         // EMU
    slideNames,
    zip,
  };
}

/**
 * 加载并解析单页幻灯片
 * @param {import('jszip')} zip
 * @param {number} index - 0-based
 * @returns {Promise<Object>} 解析后的 XML 对象
 */
export async function loadSlide(zip, index) {
  const path = `ppt/slides/slide${index + 1}.xml`;
  const file = zip.file(path);
  if (!file) throw new Error(`幻灯片文件缺失: ${path}`);

  const xml = await file.async('text');
  return parser.parse(xml);
}

/**
 * 递归收集所有 p:sp 元素（含组合内的子元素）
 * @param {Object} parent - spTree 或 grpSp 节点
 * @returns {Array<Object>} sp 元素列表
 */
export function collectSpElements(parent) {
  const result = [];

  // 本级 p:sp
  const sps = parent['p:sp'] || parent['sp'] || [];
  const spList = Array.isArray(sps) ? sps : [sps];
  for (const sp of spList) {
    if (sp) result.push(sp);
  }

  // 递归进入 p:grpSp（组合形状）
  const grps = parent['p:grpSp'] || parent['grpSp'] || [];
  const grpList = Array.isArray(grps) ? grps : [grps];
  for (const grp of grpList) {
    if (grp) {
      const inner = collectSpElements(grp);
      result.push(...inner);
    }
  }

  return result;
}

/**
 * 解析主题配色方案（schemeClr → 实际 RGB）
 * @param {import('jszip')} zip
 * @returns {Promise<Object.<string, string>>} 如 { accent1: 'C00000', dk1: '000000', ... }
 */
export async function parseThemeColors(zip, themePath = null) {
  const colors = {};

  // 找到主题文件（通常 ppt/theme/theme1.xml）
  const themeFiles = [];
  zip.forEach((relPath, file) => {
    if ((!themePath || relPath === themePath) && /^ppt\/theme\/theme\d*\.xml$/i.test(relPath) && !file.dir) {
      themeFiles.push(relPath);
    }
  });

  for (const path of themeFiles) {
    try {
      const file = zip.file(path);
      if (!file) continue;
      const xml = await file.async('text');
      const parsed = parser.parse(xml);
      const theme = parsed['a:theme'] || parsed['theme'] || parsed;
      const themeEl = theme['a:themeElements'] || theme['themeElements'];
      if (!themeEl) continue;
      const clrScheme = themeEl['a:clrScheme'] || themeEl['clrScheme'];
      if (!clrScheme) continue;

      // 遍历配色子元素：a:dk1 / a:lt1 / a:accent1 / a:accent2 / a:folHlink / a:hlink 等
      // 注意：fast-xml-parser 默认保留命名空间前缀（removeNSPrefix: false），所以 key 形如 "a:dk1"
      // 但 schemeClr 的 val 属性不带前缀（"dk1"），因此存储时需去掉前缀以匹配 resolveColor 的查询
      for (const [key, value] of Object.entries(clrScheme)) {
        if (key.startsWith('@_') || key === 'a:extLst' || key === 'extLst') continue;
        const srgb = value?.['a:srgbClr'] || value?.['srgbClr'];
        const system = value?.['a:sysClr'] || value?.['sysClr'];
        // Office normally stores dk1/lt1 as system colours. `val` is a
        // platform colour name (windowText/window), while lastClr is the
        // portable RGB fallback PowerPoint actually writes for rendering.
        const val = srgb?.['@_val'] || system?.['@_lastClr'];
        if (val) {
          const colorName = key.includes(':') ? key.split(':').pop() : key;
          colors[colorName] = val.toUpperCase();
        }
      }
      break; // 只取第一个主题文件
    } catch (e) {
      console.warn('[PptxParser] 解析主题配色失败:', path, e.message);
    }
  }

  return colors;
}

/**
 * 解析 solidFill 获取实际颜色值（支持 srgbClr 和 schemeClr）
 * @param {Object} fill
 * @param {Object.<string,string>} [themeColors]
 * @returns {string|null}
 */
function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function applyColorTransforms(hex, colorNode) {
  if (!/^[0-9A-F]{6}$/i.test(hex || '') || !colorNode) return hex;
  let rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const valueOf = name => {
    const node = colorNode[`a:${name}`] || colorNode[name];
    const value = Array.isArray(node) ? node[node.length - 1]?.['@_val'] : node?.['@_val'];
    return Number.isFinite(Number(value)) ? Number(value) / 100000 : null;
  };

  const tint = valueOf('tint');
  if (tint !== null) rgb = rgb.map(c => c + (255 - c) * tint);
  const shade = valueOf('shade');
  if (shade !== null) rgb = rgb.map(c => c * shade);

  // DrawingML 的 lumMod/lumOff 作用于 HSL 亮度。这里转换为最终屏幕 RGB 后再参与规则比较。
  const lumMod = valueOf('lumMod');
  const lumOff = valueOf('lumOff');
  if (lumMod !== null || lumOff !== null) {
    let [r, g, b] = rgb.map(c => c / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    let l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    l = Math.max(0, Math.min(1, l * (lumMod ?? 1) + (lumOff ?? 0)));
    const hue = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    if (s === 0) rgb = [l * 255, l * 255, l * 255];
    else {
      const q = l < .5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      rgb = [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map(c => c * 255);
    }
  }
  return rgb.map(c => clampByte(c).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function resolveColor(fill, themeColors) {
  if (!fill) return null;
  // 显式 RGB
  const srgb = fill['a:srgbClr'] || fill['srgbClr'];
  if (srgb) return applyColorTransforms(srgb['@_val']?.toUpperCase() || null, srgb);
  // System colours occur both in themes and (less commonly) directly in
  // text runs. lastClr is deliberately preferred because names such as
  // windowText depend on the operating-system theme.
  const system = fill['a:sysClr'] || fill['sysClr'];
  if (system) return applyColorTransforms(system['@_lastClr']?.toUpperCase() || null, system);
  // scRGB stores linear channel percentages in the 0..100000 range.
  const scrgb = fill['a:scrgbClr'] || fill['scrgbClr'];
  if (scrgb) {
    const linearToSrgb = value => {
      const c = Math.max(0, Math.min(1, Number(value) / 100000));
      return clampByte(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
    };
    const hex = ['@_r', '@_g', '@_b'].map(key => linearToSrgb(scrgb[key]).toString(16).padStart(2, '0')).join('').toUpperCase();
    return applyColorTransforms(hex, scrgb);
  }
  // 主题色引用
  const scheme = fill['a:schemeClr'] || fill['schemeClr'];
  if (scheme && themeColors) {
    const name = scheme['@_val'];
    // 兼容带/不带命名空间前缀的两种 key 形式（a:dk1 与 dk1）
    const base = themeColors[name] || themeColors['a:' + name] || null;
    return applyColorTransforms(base, scheme);
  }
  return null;
}

/**
 * 从幻灯片对象中提取文本元素
 * @param {Object} slideXml - 解析后的幻灯片 XML
 * @param {Object.<string,string>} [themeColors] - 主题配色映射（可选，用于解析 schemeClr）
 * @returns {Array<{text, fontSize, fontName, bold, color, x, y, w, h, phType}>}
 */
export function extractTexts(slideXml, themeColors, inheritedTextColors = {}) {
  const texts = [];
  const slide = slideXml['p:sld'] || slideXml['sld'] || slideXml;
  const spTree = slide['p:cSld']?.['p:spTree'] || slide['cSld']?.['spTree'] || {};

  // 递归收集所有形状（含组合内的子元素）
  const list = collectSpElements(spTree);

  for (let shapeIndex = 0; shapeIndex < list.length; shapeIndex++) {
    const sp = list[shapeIndex];
    if (!sp) continue;

    // 检查是否是占位符
    const nvs = sp['p:nvSpPr'] || sp['nvSpPr'] || {};
    const nvsPr = nvs['p:nvPr'] || nvs['nvPr'] || {};
    const ph = nvsPr['p:ph'] || nvsPr['ph'];
    // ECMA-376: p:ph 未声明 type 时默认是 obj，而不是 title。
    const phType = ph ? (ph['@_type'] || 'obj') : null;
    const inheritedFill = (phType === 'title' || phType === 'ctrTitle')
      ? inheritedTextColors.title
      : (phType ? inheritedTextColors.body : inheritedTextColors.other);

    // 提取位置
    const spPr = sp['p:spPr'] || sp['spPr'] || {};
    const shapeStyle = sp['p:style'] || sp['style'] || {};
    const fontRef = shapeStyle['a:fontRef'] || shapeStyle['fontRef'];
    const xfrm = spPr['a:xfrm'] || spPr['xfrm'] || {};
    const off = xfrm['a:off'] || xfrm['off'] || {};
    const ext = xfrm['a:ext'] || xfrm['ext'] || {};
    const x = parseFloat(off['@_x']) || 0;
    const y = parseFloat(off['@_y']) || 0;
    const w = parseFloat(ext['@_cx']) || 0;
    const h = parseFloat(ext['@_cy']) || 0;
    const rotation = (parseFloat(xfrm['@_rot']) || 0) / 60000;
    const radians = rotation * Math.PI / 180;
    const visibleW = Math.abs(w * Math.cos(radians)) + Math.abs(h * Math.sin(radians));
    const visibleH = Math.abs(w * Math.sin(radians)) + Math.abs(h * Math.cos(radians));
    const visibleX = x + (w - visibleW) / 2;
    const visibleY = y + (h - visibleH) / 2;

    // 提取文本
    const txBody = sp['p:txBody'] || sp['txBody'] || {};
    const paragraphs = txBody['a:p'] || [];
    const pars = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
    let fullText = '';
    let fontSize = null;
    let fontName = null;
    let bold = null; // null=继承未知 true=加粗 false=明确不加粗
    let color = null;
    const styleRuns = [];

    const lstDefRPr = txBody['a:lstStyle']?.['a:defPPr']?.['a:defRPr'];
    for (const p of pars) {
      const pPr = p['a:pPr'] || p['pPr'] || {};
      const defRPr = pPr['a:defRPr'] || pPr['defRPr'] || {};
      const runs = p['a:r'] || [];
      const fields = p['a:fld'] || [];
      // Field nodes (slide number/date/etc.) carry text and run properties just
      // like a:r and must participate in font scanning.
      const runList = [
        ...(Array.isArray(runs) ? runs : [runs]),
        ...(Array.isArray(fields) ? fields : [fields]),
      ].filter(Boolean);
      for (const r of runList) {
        const t = r['a:t']?.['#text'] ?? r['a:t'] ?? '';
        const start = fullText.length;
        fullText += t;
        // 取第一个有效字体属性
        const rPr = r['a:rPr'] || r['rPr'] || {};
        if (!fontSize && rPr['@_sz']) fontSize = parseFloat(rPr['@_sz']) / 100;
        if (!fontName) fontName = rPr['@_typeface'] || (rPr['a:latin']?.['@_typeface']);
        bold = mergeBold(
          bold,
          readBold(rPr) ?? readBold(defRPr) ?? readBold(lstDefRPr),
        );
        if (!color) {
          const solidFill = rPr['a:solidFill'] || rPr['solidFill'];
          const c = resolveColor(solidFill, themeColors);
          if (c) color = c;
        }
        const runFont = rPr['@_typeface'] || rPr['a:ea']?.['@_typeface'] || rPr['a:latin']?.['@_typeface'] ||
          defRPr['@_typeface'] || defRPr['a:ea']?.['@_typeface'] || defRPr['a:latin']?.['@_typeface'] ||
          lstDefRPr?.['@_typeface'] || lstDefRPr?.['a:ea']?.['@_typeface'] || lstDefRPr?.['a:latin']?.['@_typeface'] || null;
        const inheritedTypeface = rPr['@_typeface'] || defRPr['@_typeface'] || lstDefRPr?.['@_typeface'] || null;
        const latinFont = rPr['a:latin']?.['@_typeface'] || inheritedTypeface ||
          defRPr['a:latin']?.['@_typeface'] || lstDefRPr?.['a:latin']?.['@_typeface'] || null;
        const eastAsianFont = rPr['a:ea']?.['@_typeface'] || inheritedTypeface ||
          defRPr['a:ea']?.['@_typeface'] || lstDefRPr?.['a:ea']?.['@_typeface'] || null;
        const complexFont = rPr['a:cs']?.['@_typeface'] || inheritedTypeface ||
          defRPr['a:cs']?.['@_typeface'] || lstDefRPr?.['a:cs']?.['@_typeface'] || null;
        const runFill = rPr['a:solidFill'] || rPr['solidFill'] ||
          defRPr['a:solidFill'] || defRPr['solidFill'] ||
          lstDefRPr?.['a:solidFill'] || lstDefRPr?.['solidFill'] ||
          fontRef || inheritedFill;
        // 没有直接颜色时，普通文本按主题文字色 tx1 渲染；tx1 已由母版 clrMap 映射。
        const runColor = resolveColor(runFill, themeColors) ||
          resolveColor({ 'a:schemeClr': { '@_val': 'tx1' } }, themeColors);
        styleRuns.push({
          start,
          end: fullText.length,
          text: String(t),
          fontName: runFont,
          latinFont,
          eastAsianFont,
          complexFont,
          fontSize: rPr['@_sz'] ? parseFloat(rPr['@_sz']) / 100 : (defRPr['@_sz'] ? parseFloat(defRPr['@_sz']) / 100 : null),
          bold: readBold(rPr) ?? readBold(defRPr) ?? readBold(lstDefRPr),
          color: runColor,
        });
      }
      // 检查段落默认属性（defRPr）— 独立处理每项属性
      if (!fontSize && defRPr['@_sz']) fontSize = parseFloat(defRPr['@_sz']) / 100;
      if (!fontName) fontName = defRPr['@_typeface'] || (defRPr['a:latin']?.['@_typeface']);
      // 段落换行
      if (runList.length > 0) fullText += '\n';
    }

    // 检查文本框级默认样式（lstStyle — 占位符/文本框的默认格式，PowerPoint 常用此层继承加粗）
    if (lstDefRPr) {
      if (!fontSize && lstDefRPr['@_sz']) fontSize = parseFloat(lstDefRPr['@_sz']) / 100;
      if (!fontName) fontName = lstDefRPr['@_typeface'] || (lstDefRPr['a:latin']?.['@_typeface']);
      if (!color) {
        const solidFill = lstDefRPr['a:solidFill'] || lstDefRPr['solidFill'];
        const c = resolveColor(solidFill, themeColors);
        if (c) color = c;
      }
    }

    // 形状样式的 fontRef 是文本颜色；spPr/solidFill 是形状背景色，不能当作文字颜色。
    if (!color) {
      const c = resolveColor(fontRef || inheritedFill, themeColors);
      if (c) color = c;
    }

    if (fullText.trim()) {
      texts.push({
        text: fullText.trim(),
        fontSize,
        fontName,
        bold,
        color,
        x, y, w, h, rotation, visibleX, visibleY, visibleW, visibleH,
        phType,
        styleRuns,
        shapeIndex,
        shapeId: sp['@_id'] || nvs['p:cNvPr']?.['@_id'] || nvs['cNvPr']?.['@_id'],
      });
    }
  }

  return texts;
}

/**
 * 解析所有版式文件中的标题占位符位置
 * @param {import('jszip')} zip
 * @returns {Promise<Map<string, {x:number, y:number, w:number, h:number}>>} layoutPath → 标题占位符位置
 */
export async function extractLayoutTitlePositions(zip) {
  const positions = new Map();

  // 收集所有版式文件
  const layoutFiles = [];
  zip.forEach((relPath, file) => {
    if (relPath.startsWith('ppt/slideLayouts/') && relPath.endsWith('.xml') && !file.dir) {
      layoutFiles.push(relPath);
    }
  });

  for (const path of layoutFiles) {
    try {
      const file = zip.file(path);
      if (!file) continue;
      const xml = await file.async('text');
      const parsed = parser.parse(xml);
      const sldLayout = parsed['p:sldLayout'] || parsed['sldLayout'] || parsed;
      const cSld = sldLayout['p:cSld'] || sldLayout['cSld'];
      if (!cSld) continue;
      const spTree = cSld['p:spTree'] || cSld['spTree'];
      if (!spTree) continue;
      const shapes = spTree['p:sp'] || spTree['sp'] || [];
      const list = Array.isArray(shapes) ? shapes : [shapes];

      for (const sp of list) {
        if (!sp) continue;
        const nvs = sp['p:nvSpPr'] || sp['nvSpPr'] || {};
        const nvsPr = nvs['p:nvPr'] || nvs['nvPr'] || {};
        const ph = nvsPr['p:ph'] || nvsPr['ph'];
        if (!ph) continue;
        const phType = ph['@_type'];
        if (phType === 'title' || phType === 'ctrTitle') {
          const spPr = sp['p:spPr'] || sp['spPr'] || {};
          const xfrm = spPr['a:xfrm'] || spPr['xfrm'] || {};
          const off = xfrm['a:off'] || xfrm['off'] || {};
          const ext = xfrm['a:ext'] || xfrm['ext'] || {};
          positions.set(path, {
            x: parseFloat(off['@_x']) || 0,
            y: parseFloat(off['@_y']) || 0,
            w: parseFloat(ext['@_cx']) || 0,
            h: parseFloat(ext['@_cy']) || 0,
          });
          break; // 每个版式只取第一个标题占位符
        }
      }
    } catch (e) {
      console.warn('[PptxParser] 解析版式文件失败:', path, e.message);
    }
  }

  return positions;
}

/**
 * 获取每张幻灯片关联的版式文件路径
 * @param {import('jszip')} zip
 * @param {number} slideCount
 * @returns {Promise<Array<string|null>>} slide index → layout path (null=未找到)
 */
export async function getSlideLayoutMap(zip, slideCount) {
  const map = [];
  for (let i = 0; i < slideCount; i++) {
    const relsPath = `ppt/slides/_rels/slide${i + 1}.xml.rels`;
    try {
      const relsFile = zip.file(relsPath);
      if (!relsFile) { map.push(null); continue; }
      const xml = await relsFile.async('text');
      const parsed = parser.parse(xml);
      const relationships = parsed['Relationships'] || {};
      const relList = relationships['Relationship'];
      const rels = Array.isArray(relList) ? relList : (relList ? [relList] : []);
      const layoutRel = rels.find(r =>
        r['@_Type'] && r['@_Type'].includes('slideLayout')
      );
      if (!layoutRel) { map.push(null); continue; }
      // 从 rels 路径解析版式文件路径
      // rels 文件在 ppt/slides/_rels/slideN.xml.rels
      // Target 形如 ../slideLayouts/slideLayoutN.xml
      // 解析为 ppt/slideLayouts/slideLayoutN.xml
      const target = layoutRel['@_Target'];
      const resolved = target.replace(/^\.\.\//, 'ppt/');
      map.push(resolved);
    } catch (e) {
      console.warn(`[PptxParser] 解析 slide ${i + 1} rels 失败:`, e.message);
      map.push(null);
    }
  }
  return map;
}

function resolvePartTarget(sourcePart, target) {
  if (!target) return null;
  if (target.startsWith('/')) return target.slice(1);
  const parts = sourcePart.split('/');
  parts.pop();
  for (const part of target.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

async function relatedPart(zip, sourcePart, relationshipType) {
  const slash = sourcePart.lastIndexOf('/');
  const relsPath = `${sourcePart.slice(0, slash)}/_rels/${sourcePart.slice(slash + 1)}.rels`;
  const file = zip.file(relsPath);
  if (!file) return null;
  const parsed = parser.parse(await file.async('text'));
  const value = (parsed.Relationships || {}).Relationship;
  const relationships = Array.isArray(value) ? value : (value ? [value] : []);
  const relationship = relationships.find(rel => rel['@_Type']?.includes(relationshipType));
  return relationship ? resolvePartTarget(sourcePart, relationship['@_Target']) : null;
}

/**
 * 按幻灯片版式追踪到对应主题。一个 PPTX 可以有多个母版和主题，不能全局使用 theme1。
 * @returns {Promise<Map<string,string>>} layoutPath → themePath
 */
export async function getLayoutThemeMap(zip, layoutPaths) {
  const result = new Map();
  const masterThemes = new Map();
  for (const layoutPath of new Set(layoutPaths.filter(Boolean))) {
    try {
      const masterPath = await relatedPart(zip, layoutPath, 'slideMaster');
      if (!masterPath) continue;
      let themePath = masterThemes.get(masterPath);
      if (themePath === undefined) {
        themePath = await relatedPart(zip, masterPath, '/theme') || null;
        masterThemes.set(masterPath, themePath);
      }
      if (themePath) result.set(layoutPath, themePath);
    } catch (e) {
      console.warn('[PptxParser] 解析版式主题关系失败:', layoutPath, e.message);
    }
  }
  return result;
}

function readColorMap(node) {
  if (!node) return {};
  const mapping = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_') && typeof value === 'string') mapping[key.slice(2)] = value;
  }
  return mapping;
}

/** @returns {Promise<Map<string,Object>>} layoutPath → clrMap (tx1/bg1/... → dk1/lt1/...) */
export async function getLayoutColorMap(zip, layoutPaths) {
  const result = new Map();
  const masterMaps = new Map();
  for (const layoutPath of new Set(layoutPaths.filter(Boolean))) {
    try {
      const masterPath = await relatedPart(zip, layoutPath, 'slideMaster');
      if (!masterPath) continue;
      let mapping = masterMaps.get(masterPath);
      if (!mapping) {
        const file = zip.file(masterPath);
        const parsed = file ? parser.parse(await file.async('text')) : {};
        const master = parsed['p:sldMaster'] || parsed.sldMaster || parsed;
        mapping = readColorMap(master['p:clrMap'] || master.clrMap);
        masterMaps.set(masterPath, mapping);
      }

      // 版式可以用 overrideClrMapping 覆盖母版映射。
      const layoutFile = zip.file(layoutPath);
      if (layoutFile) {
        const parsed = parser.parse(await layoutFile.async('text'));
        const layout = parsed['p:sldLayout'] || parsed.sldLayout || parsed;
        const override = layout['p:clrMapOvr'] || layout.clrMapOvr;
        const overrideMap = readColorMap(override?.['a:overrideClrMapping'] || override?.overrideClrMapping);
        if (Object.keys(overrideMap).length) mapping = { ...mapping, ...overrideMap };
      }
      result.set(layoutPath, mapping);
    } catch (e) {
      console.warn('[PptxParser] 解析版式颜色映射失败:', layoutPath, e.message);
    }
  }
  return result;
}

function textStyleFill(style) {
  if (!style) return null;
  for (let level = 1; level <= 9; level++) {
    const pPr = style[`a:lvl${level}pPr`] || style[`lvl${level}pPr`];
    const rPr = pPr?.['a:defRPr'] || pPr?.defRPr;
    const fill = rPr?.['a:solidFill'] || rPr?.solidFill;
    if (fill) return fill;
  }
  return null;
}

/** 读取母版的 titleStyle/bodyStyle/otherStyle 文字颜色继承。 */
export async function getLayoutTextColorStyles(zip, layoutPaths) {
  const result = new Map();
  const masterStyles = new Map();
  for (const layoutPath of new Set(layoutPaths.filter(Boolean))) {
    try {
      const masterPath = await relatedPart(zip, layoutPath, 'slideMaster');
      if (!masterPath) continue;
      let styles = masterStyles.get(masterPath);
      if (!styles) {
        const file = zip.file(masterPath);
        const parsed = file ? parser.parse(await file.async('text')) : {};
        const master = parsed['p:sldMaster'] || parsed.sldMaster || parsed;
        const txStyles = master['p:txStyles'] || master.txStyles || {};
        styles = {
          title: textStyleFill(txStyles['p:titleStyle'] || txStyles.titleStyle),
          body: textStyleFill(txStyles['p:bodyStyle'] || txStyles.bodyStyle),
          other: textStyleFill(txStyles['p:otherStyle'] || txStyles.otherStyle),
        };
        masterStyles.set(masterPath, styles);
      }
      result.set(layoutPath, styles);
    } catch (e) {
      console.warn('[PptxParser] 解析母版文本颜色失败:', layoutPath, e.message);
    }
  }
  return result;
}

export function applyColorMap(themeColors, colorMap) {
  const resolved = { ...themeColors };
  for (const [alias, target] of Object.entries(colorMap || {})) {
    if (themeColors[target]) resolved[alias] = themeColors[target];
  }
  return resolved;
}

/**
 * 提取形状位置信息
 */
function extractPos(xfrm) {
  const off = xfrm['a:off'] || {};
  const ext = xfrm['a:ext'] || {};
  return {
    x: parseFloat(off['@_x']) || 0,
    y: parseFloat(off['@_y']) || 0,
    w: parseFloat(ext['@_cx']) || 0,
    h: parseFloat(ext['@_cy']) || 0,
  };
}

/**
 * 从幻灯片中提取非文本形状（图片、纯形状等）
 * @param {Object} slideXml
 * @returns {Array<{type, x, y, w, h, name?}>}
 */
export function extractShapes(slideXml) {
  const shapes = [];
  const slide = slideXml['p:sld'] || slideXml['sld'] || slideXml;
  const cSld = slide['p:cSld'] || slide['cSld'] || {};
  const spTree = cSld['p:spTree'] || cSld['spTree'] || {};

  // 图片 p:pic
  const pics = spTree['p:pic'];
  const picList = pics ? (Array.isArray(pics) ? pics : [pics]) : [];
  for (const pic of picList) {
    if (!pic) continue;
    const spPr = pic['p:spPr'] || pic['spPr'] || {};
    shapes.push({ type: 'image', ...extractPos(spPr['a:xfrm'] || {}), name: '图片' });
  }

  // 图形框架（表格、图表等）p:graphicFrame
  const gfs = spTree['p:graphicFrame'];
  const gfList = gfs ? (Array.isArray(gfs) ? gfs : [gfs]) : [];
  for (const gf of gfList) {
    if (!gf) continue;
    const xfrm = gf['p:xfrm'] || gf['xfrm'] || {};
    shapes.push({ type: 'graphic-frame', ...extractPos(xfrm), name: '图表/表格' });
  }

  // 组合对象 p:grpSp（只记录组合整体，不展开子对象）
  const grps = spTree['p:grpSp'];
  const grpList = grps ? (Array.isArray(grps) ? grps : [grps]) : [];
  for (const grp of grpList) {
    if (!grp) continue;
    const grpPr = grp['p:grpSpPr'] || grp['grpSpPr'] || {};
    shapes.push({ type: 'group', ...extractPos(grpPr['a:xfrm'] || {}), name: '组合' });
  }

  // 纯形状（p:sp 但没有文本体）
  const sps = spTree['p:sp'] || spTree['sp'] || [];
  const spList = Array.isArray(sps) ? sps : [sps];
  for (const sp of spList) {
    if (!sp) continue;
    const txBody = sp['p:txBody'] || sp['txBody'];
    if (!txBody) {
      const spPr = sp['p:spPr'] || sp['spPr'] || {};
      shapes.push({ type: 'shape', ...extractPos(spPr['a:xfrm'] || {}), name: '形状' });
    }
  }

  return shapes;
}
