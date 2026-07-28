import test from 'node:test';
import assert from 'node:assert/strict';

import { extractTexts } from '../src/core/pptxParser.js';
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
