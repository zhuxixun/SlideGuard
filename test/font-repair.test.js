import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { extractTexts } from '../src/core/pptxParser.js';
import { check as checkFont } from '../src/core/rules/r004.js';
import { fixIssues } from '../src/core/fixEngine.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseNumbers: false,
  trimValues: false,
});

function slideXml(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
    <p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="7" name="Text"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr/><p:txBody><a:bodyPr/><a:lstStyle>${body.listStyle || ''}</a:lstStyle><a:p>${body.runs}</a:p></p:txBody>
    </p:sp></p:spTree></p:cSld></p:sld>`;
}

test('R004 detects a non-standard font in a later mixed-font run', () => {
  const xml = slideXml({ runs: `
    <a:r><a:rPr><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/></a:rPr><a:t>标准</a:t></a:r>
    <a:r><a:rPr><a:latin typeface="Arial"/><a:ea typeface="宋体"/></a:rPr><a:t>异常</a:t></a:r>` });
  const texts = extractTexts(xmlParser.parse(xml));
  const issues = checkFont({ texts, page: 1 }, {});

  assert.equal(issues.length, 1);
  assert.match(issues[0].actual, /宋体|Arial/);
});

test('R004 repair overrides inherited fonts and every text run', async () => {
  const xml = slideXml({
    listStyle: '<a:defPPr><a:defRPr><a:latin typeface="Arial"/><a:ea typeface="宋体"/></a:defRPr></a:defPPr>',
    runs: '<a:r><a:t>继承字体</a:t></a:r><a:r><a:rPr><a:latin typeface="Arial"/></a:rPr><a:t>显式字体</a:t></a:r>',
  });
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', xml);
  const input = await zip.generateAsync({ type: 'arraybuffer' });
  const issue = {
    rule: 'R004', page: 1, fixable: true,
    fixData: { shapeId: '7', targetFont: '微软雅黑' },
  };

  const result = await fixIssues(input, [issue]);
  assert.equal(result.fixed, 1);
  assert.equal(result.failed, 0);

  const outputZip = await JSZip.loadAsync(result.buffer);
  const repaired = xmlParser.parse(await outputZip.file('ppt/slides/slide1.xml').async('text'));
  const texts = extractTexts(repaired);
  assert.equal(checkFont({ texts, page: 1 }, {}).length, 0);

  const shape = repaired['p:sld']['p:cSld']['p:spTree']['p:sp'];
  const runs = shape['p:txBody']['a:p']['a:r'];
  for (const run of runs) {
    assert.equal(run['a:rPr']['a:latin']['@_typeface'], '微软雅黑');
    assert.equal(run['a:rPr']['a:ea']['@_typeface'], '微软雅黑');
  }
});
