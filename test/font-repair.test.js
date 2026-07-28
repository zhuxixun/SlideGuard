import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { extractTexts } from '../src/core/pptxParser.js';
import { check as checkFont } from '../src/core/rules/r004.js';
import { fixIssues } from '../src/core/fixEngine.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseNumbers: false });

function slideXml(runs) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="7" name="Text"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${runs}</a:p></p:txBody>
  </p:sp></p:spTree></p:cSld></p:sld>`;
}

function issuesFor(xml) {
  return checkFont({ texts: extractTexts(parser.parse(xml)), page: 1 }, {});
}

function slideXmlWithDuplicateIds() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="7" name="First"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/><a:cs typeface="微软雅黑"/></a:rPr><a:t>Already fixed</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="7" name="Second"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr><a:latin typeface="Calibri"/><a:ea typeface="Arial"/></a:rPr><a:t>待修复ABC</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld></p:sld>`;
}

test('R004 checks every mixed-font run using the font slot for its script', () => {
  const xml = slideXml(`
    <a:r><a:rPr><a:latin typeface="微软雅黑"/><a:ea typeface="Arial"/></a:rPr><a:t>English 123</a:t></a:r>
    <a:r><a:rPr><a:latin typeface="Arial"/><a:ea typeface="宋体"/></a:rPr><a:t>中文</a:t></a:r>`);
  const issues = issuesFor(xml);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].actual, '字体：宋体');
});

test('R004 does not mistake unresolved theme placeholders for font names', () => {
  const xml = slideXml('<a:r><a:rPr><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/></a:rPr><a:t>中文ABC</a:t></a:r>');
  assert.equal(issuesFor(xml).length, 0);
});

test('R004 scans field text such as slide numbers', () => {
  const xml = slideXml('<a:fld id="{1}" type="slidenum"><a:rPr><a:latin typeface="Arial"/></a:rPr><a:t>2</a:t></a:fld>');
  const issues = issuesFor(xml);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].actual, '字体：Arial');
});

test('font repair explicitly overrides inherited fonts and passes a rescan', async () => {
  const xml = slideXml(`
    <a:pPr><a:defRPr><a:latin typeface="Arial"/><a:ea typeface="宋体"/></a:defRPr></a:pPr>
    <a:r><a:t>继承字体</a:t></a:r>
    <a:fld id="{1}" type="slidenum"><a:rPr><a:latin typeface="Arial"/></a:rPr><a:t>2</a:t></a:fld>`);
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', xml);
  const input = await zip.generateAsync({ type: 'arraybuffer' });
  const issue = { rule: 'R004', page: 1, fixable: true, fixData: { shapeId: '7', targetFont: '微软雅黑' } };
  const result = await fixIssues(input, [issue]);
  assert.equal(result.fixed, 1);
  assert.equal(result.failed, 0);

  const output = await JSZip.loadAsync(result.buffer);
  const repairedXml = await output.file('ppt/slides/slide1.xml').async('text');
  assert.equal(issuesFor(repairedXml).length, 0);
  assert.match(repairedXml, /<a:ea typeface="微软雅黑"/);
  assert.match(repairedXml, /<a:cs typeface="微软雅黑"/);
});

test('font repair replaces Microsoft YaHei UI in the run typeface attribute', async () => {
  const xml = slideXml(`
    <a:r><a:rPr typeface="Microsoft YaHei UI"><a:latin typeface="Microsoft YaHei UI"/><a:ea typeface="Microsoft YaHei UI"/></a:rPr><a:t>中文ABC</a:t></a:r>`);
  assert.equal(issuesFor(xml).length, 1);

  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', xml);
  const input = await zip.generateAsync({ type: 'arraybuffer' });
  const issue = { rule: 'R004', page: 1, fixable: true, fixData: { shapeId: '7', targetFont: '微软雅黑' } };
  const result = await fixIssues(input, [issue]);

  assert.equal(result.fixed, 1);
  assert.equal(result.failed, 0);
  const output = await JSZip.loadAsync(result.buffer);
  const repairedXml = await output.file('ppt/slides/slide1.xml').async('text');
  assert.equal(issuesFor(repairedXml).length, 0);
  assert.doesNotMatch(repairedXml, /Microsoft YaHei UI/);
});

test('font repair targets the scanned shape when duplicate shape ids exist', async () => {
  const xml = slideXmlWithDuplicateIds();
  const issues = issuesFor(xml);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].fixData.shapeId, '7');
  assert.equal(issues[0].fixData.shapeIndex, 1);

  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', xml);
  const input = await zip.generateAsync({ type: 'arraybuffer' });
  const result = await fixIssues(input, issues);

  assert.equal(result.fixed, 1);
  assert.equal(result.failed, 0);
  const output = await JSZip.loadAsync(result.buffer);
  const repairedXml = await output.file('ppt/slides/slide1.xml').async('text');
  assert.equal(issuesFor(repairedXml).length, 0);
  assert.doesNotMatch(repairedXml, /Calibri|Arial/);
});
