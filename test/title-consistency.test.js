import test from 'node:test';
import assert from 'node:assert/strict';

import JSZip from 'jszip';
import { applyColorMap, extractTexts, getLayoutColorMap, getLayoutThemeMap, parseThemeColors, resolveColor } from '../src/core/pptxParser.js';
import { check, selectTitle } from '../src/core/rules/r008.js';

const presInfo = { width: 10_000, height: 7_500 };

test('selectTitle does not treat an untyped body placeholder outside the title region as a title', () => {
  const body = {
    text: '这是正文内容', phType: null,
    x: 500, y: 2_000, w: 9_000, h: 4_000, fontSize: 32,
  };
  const title = {
    text: '页面标题', phType: null,
    x: 500, y: 300, w: 9_000, h: 800, fontSize: 24,
  };

  assert.equal(selectTitle({ texts: [body, title] }, presInfo), title);
});

test('selectTitle ignores placeholder semantics and follows the final visual layout', () => {
  const misplacedPlaceholder = {
    text: '被改作正文的标题占位符', phType: 'title',
    x: 500, y: 2_000, w: 9_000, h: 2_000, fontSize: 12,
  };
  const visualTitle = {
    text: '普通文本框制作的真实标题', phType: null,
    x: 500, y: 300, w: 9_000, h: 800, fontSize: 24,
  };

  assert.equal(selectTitle({ texts: [misplacedPlaceholder, visualTitle] }, presInfo), visualTitle);
  assert.equal(selectTitle({ texts: [misplacedPlaceholder] }, presInfo), null);
});

test('a placeholder in the visual title region may still act as the title regardless of its type', () => {
  const visualTitle = { text: '视觉标题', phType: 'obj', x: 500, y: 300, w: 9000, h: 800, fontSize: 24 };
  assert.equal(selectTitle({ texts: [visualTitle] }, presInfo), visualTitle);
});

test('ignores a corrupted layout title region and ranks visual position before unresolved font size', () => {
  const title = { text: '真实标题', phType: null, x: 500, y: 300, w: 9000, h: 700, fontSize: null };
  const body = { text: '显式小字号正文', phType: 'title', x: 500, y: 1250, w: 9000, h: 500, fontSize: 12 };
  const slide = {
    texts: [body, title],
    // 模板里的标题占位符已经被错误地放到了正文区域。
    layoutTitlePos: { x: 500, y: 1250, w: 9000, h: 500 },
  };
  assert.equal(selectTitle(slide, presInfo), title);
});

test('uses the theme related through each layout and slide master', async () => {
  const zip = new JSZip();
  zip.file('ppt/slideLayouts/_rels/slideLayout2.xml.rels', `
    <Relationships><Relationship Type="x/slideMaster" Target="../slideMasters/slideMaster2.xml"/></Relationships>`);
  zip.file('ppt/slideMasters/_rels/slideMaster2.xml.rels', `
    <Relationships><Relationship Type="x/theme" Target="../theme/theme2.xml"/></Relationships>`);
  zip.file('ppt/theme/theme1.xml', `<a:theme><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="C00000"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`);
  zip.file('ppt/theme/theme2.xml', `<a:theme><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="4472C4"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`);

  const layoutPath = 'ppt/slideLayouts/slideLayout2.xml';
  const map = await getLayoutThemeMap(zip, [layoutPath]);
  assert.equal(map.get(layoutPath), 'ppt/theme/theme2.xml');
  assert.deepEqual(await parseThemeColors(zip, map.get(layoutPath)), { accent1: '4472C4' });
});

test('extractTexts resolves schemeClr before R008 checks the title color', () => {
  const slideXml = {
    'p:sld': {
      'p:cSld': {
        'p:spTree': {
          'p:sp': {
            'p:nvSpPr': {
              'p:cNvPr': { '@_id': '7' },
              'p:nvPr': { 'p:ph': { '@_type': 'title' } },
            },
            'p:spPr': {
              'a:xfrm': {
                'a:off': { '@_x': '500', '@_y': '300' },
                'a:ext': { '@_cx': '9000', '@_cy': '800' },
              },
            },
            'p:txBody': {
              'a:p': {
                'a:r': {
                  'a:rPr': {
                    '@_b': '1',
                    'a:solidFill': { 'a:schemeClr': { '@_val': 'accent1' } },
                  },
                  'a:t': '主题色标题',
                },
              },
            },
          },
        },
      },
    },
  };

  const texts = extractTexts(slideXml, { accent1: '4472C4' });
  assert.equal(texts[0].styleRuns[0].color, '4472C4');

  const issues = check({ page: 1, texts }, presInfo);
  assert.equal(issues.filter(issue => issue.property === 'color').length, 1);
});

test('resolves theme color transforms to the final visual RGB', () => {
  const fill = {
    'a:schemeClr': {
      '@_val': 'accent1',
      'a:tint': { '@_val': '50000' },
    },
  };
  assert.equal(resolveColor(fill, { accent1: 'C00000' }), 'E08080');
});

test('uses shape fontRef for text color and never confuses the shape background with text', () => {
  const slideXml = {
    'p:sld': { 'p:cSld': { 'p:spTree': { 'p:sp': {
      'p:nvSpPr': { 'p:cNvPr': { '@_id': '9' }, 'p:nvPr': {} },
      'p:spPr': {
        'a:xfrm': { 'a:off': { '@_x': '500', '@_y': '300' }, 'a:ext': { '@_cx': '9000', '@_cy': '800' } },
        'a:solidFill': { 'a:srgbClr': { '@_val': 'C00000' } },
      },
      'p:style': { 'a:fontRef': { 'a:schemeClr': { '@_val': 'accent1' } } },
      'p:txBody': { 'a:p': { 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': '视觉颜色标题' } } },
    } } } },
  };
  const texts = extractTexts(slideXml, { accent1: '4472C4' });
  assert.equal(texts[0].styleRuns[0].color, '4472C4');
  assert.equal(check({ page: 1, texts }, presInfo).some(issue => issue.property === 'color'), true);
});

test('maps tx1 through the slide master clrMap before resolving the visual color', async () => {
  const zip = new JSZip();
  const layoutPath = 'ppt/slideLayouts/slideLayout1.xml';
  zip.file('ppt/slideLayouts/slideLayout1.xml', '<p:sldLayout/>');
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `
    <Relationships><Relationship Type="x/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  zip.file('ppt/slideMasters/slideMaster1.xml', '<p:sldMaster><p:clrMap tx1="accent1" bg1="lt1"/></p:sldMaster>');

  const maps = await getLayoutColorMap(zip, [layoutPath]);
  assert.deepEqual(maps.get(layoutPath), { tx1: 'accent1', bg1: 'lt1' });
  const colors = applyColorMap({ accent1: '4472C4', lt1: 'FFFFFF' }, maps.get(layoutPath));
  assert.equal(resolveColor({ 'a:schemeClr': { '@_val': 'tx1' } }, colors), '4472C4');
});
