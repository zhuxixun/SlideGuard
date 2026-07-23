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
 * 从幻灯片对象中提取文本元素
 * @param {Object} slideXml - 解析后的幻灯片 XML
 * @returns {Array<{text, fontSize, fontName, bold, color, x, y, w, h, isTitle}>}
 */
export function extractTexts(slideXml) {
  const texts = [];
  const slide = slideXml['p:sld'] || slideXml['sld'] || slideXml;
  const spTree = slide['p:cSld']?.['p:spTree'] || slide['cSld']?.['spTree'] || {};
  const shapes = spTree['p:sp'] || spTree['sp'] || [];

  const list = Array.isArray(shapes) ? shapes : [shapes];

  for (const sp of list) {
    if (!sp) continue;

    // 检查是否是占位符
    const nvs = sp['p:nvSpPr'] || sp['nvSpPr'] || {};
    const nvsPr = nvs['p:nvPr'] || nvs['nvPr'] || {};
    const ph = nvsPr['p:ph'] || nvsPr['ph'];
    const isTitle = ph && (ph['@_type'] === 'title' || ph['@_type'] === 'ctrTitle' || ph['@_type'] === undefined);
    const phType = ph?.['@_type'] || (ph ? 'title' : null);

    // 提取位置
    const spPr = sp['p:spPr'] || sp['spPr'] || {};
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
      const runList = Array.isArray(runs) ? runs : [runs];
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
          const srgb = solidFill?.['a:srgbClr'] || solidFill?.['srgbClr'];
          if (srgb) color = srgb['@_val'];
        }
        const runFont = rPr['@_typeface'] || rPr['a:ea']?.['@_typeface'] || rPr['a:latin']?.['@_typeface'] ||
          defRPr['@_typeface'] || defRPr['a:ea']?.['@_typeface'] || defRPr['a:latin']?.['@_typeface'] ||
          lstDefRPr?.['@_typeface'] || lstDefRPr?.['a:ea']?.['@_typeface'] || lstDefRPr?.['a:latin']?.['@_typeface'] || null;
        const runFill = rPr['a:solidFill'] || defRPr['a:solidFill'] || lstDefRPr?.['a:solidFill'];
        const runColor = runFill?.['a:srgbClr']?.['@_val'] || null;
        styleRuns.push({
          start,
          end: fullText.length,
          text: String(t),
          fontName: runFont,
          fontSize: rPr['@_sz'] ? parseFloat(rPr['@_sz']) / 100 : (defRPr['@_sz'] ? parseFloat(defRPr['@_sz']) / 100 : null),
          bold: readBold(rPr) ?? readBold(defRPr) ?? readBold(lstDefRPr),
          color: runColor,
        });
      }
      // 检查段落默认属性（defRPr）— 独立处理每项属性
      if (!fontSize && defRPr['@_sz']) fontSize = parseFloat(defRPr['@_sz']) / 100;
      if (!fontName) fontName = defRPr['@_typeface'] || (defRPr['a:latin']?.['@_typeface']);
      // 段落换行
      if (runs.length > 0) fullText += '\n';
    }

    // 检查文本框级默认样式（lstStyle — 占位符/文本框的默认格式，PowerPoint 常用此层继承加粗）
    if (lstDefRPr) {
      if (!fontSize && lstDefRPr['@_sz']) fontSize = parseFloat(lstDefRPr['@_sz']) / 100;
      if (!fontName) fontName = lstDefRPr['@_typeface'] || (lstDefRPr['a:latin']?.['@_typeface']);
      if (!color) {
        const solidFill = lstDefRPr['a:solidFill'] || lstDefRPr['solidFill'];
        const srgb = solidFill?.['a:srgbClr'] || solidFill?.['srgbClr'];
        if (srgb) color = srgb['@_val'];
      }
    }

    if (fullText.trim()) {
      texts.push({
        text: fullText.trim(),
        fontSize,
        fontName,
        bold,
        color,
        x, y, w, h, rotation, visibleX, visibleY, visibleW, visibleH,
        isTitle,
        phType,
        styleRuns,
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
        if (phType === 'title' || phType === 'ctrTitle' || phType === undefined) {
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
