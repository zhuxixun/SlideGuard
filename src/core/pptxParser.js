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
});

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

    // 提取文本
    const txBody = sp['p:txBody'] || sp['txBody'] || {};
    const paragraphs = txBody['a:p'] || [];
    const pars = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
    let fullText = '';
    let fontSize = null;
    let fontName = null;
    let bold = false;
    let color = null;

    for (const p of pars) {
      const runs = p['a:r'] || [];
      const runList = Array.isArray(runs) ? runs : [runs];
      for (const r of runList) {
        const t = r['a:t']?.['#text'] ?? r['a:t'] ?? '';
        fullText += t;
        // 取第一个有效字体属性
        const rPr = r['a:rPr'] || r['rPr'] || {};
        if (!fontSize && rPr['@_sz']) fontSize = parseFloat(rPr['@_sz']) / 100;
        if (!fontName) fontName = rPr['@_typeface'] || (rPr['a:latin']?.['@_typeface']);
        if (!bold) bold = rPr['@_b'] === '1' || rPr['@_b'] === true;
        if (!color) {
          const solidFill = rPr['a:solidFill'] || rPr['solidFill'];
          const srgb = solidFill?.['a:srgbClr'] || solidFill?.['srgbClr'];
          if (srgb) color = srgb['@_val'];
        }
      }
      // 检查段落默认属性（defRPr）— 独立处理每项属性
      const pPr = p['a:pPr'] || p['pPr'] || {};
      const defRPr = pPr['a:defRPr'] || pPr['defRPr'] || {};
      if (!fontSize && defRPr['@_sz']) fontSize = parseFloat(defRPr['@_sz']) / 100;
      if (!fontName) fontName = defRPr['@_typeface'] || (defRPr['a:latin']?.['@_typeface']);
      if (!bold) bold = defRPr['@_b'] === '1' || defRPr['@_b'] === true;
      // 段落换行
      if (runs.length > 0) fullText += '\n';
    }

    if (fullText.trim()) {
      texts.push({
        text: fullText.trim(),
        fontSize,
        fontName,
        bold,
        color,
        x, y, w, h,
        isTitle,
        phType,
        shapeId: sp['@_id'] || nvs['p:cNvPr']?.['@_id'] || nvs['cNvPr']?.['@_id'],
      });
    }
  }

  return texts;
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
