/**
 * 规则引擎 — 扫描调度器
 *
 * 工作流程：
 *   1. 从 ArrayBuffer 重新加载 ZIP
 *   2. 解析所有幻灯片
 *   3. 逐页执行页面级规则
 *   4. 执行跨页规则
 *   5. 汇总结果
 */
import JSZip from 'jszip';
import { parsePptx, loadSlide, extractTexts, extractShapes } from './pptxParser.js';
import { store } from '../store.js';

/* 规则注册表 */
import { check as checkR002, rule as ruleR002 } from './rules/r002.js';
import { check as checkR003, rule as ruleR003 } from './rules/r003.js';
import { check as checkR004, rule as ruleR004 } from './rules/r004.js';
import { check as checkR005, checkCrossPage as checkR005Cross, rule as ruleR005 } from './rules/r005.js';
import { check as checkR006, rule as ruleR006 } from './rules/r006.js';
import { check as checkR007, rule as ruleR007 } from './rules/r007.js';
import { check as checkR008, rule as ruleR008 } from './rules/r008.js';
import { check as checkR009, checkCrossPage as checkR009Cross, rule as ruleR009 } from './rules/r009.js';
import { check as checkR010, rule as ruleR010 } from './rules/r010.js';

const ruleRegistry = {
  R002: { ...ruleR002, check: checkR002 },
  R003: { ...ruleR003, check: checkR003 },
  R004: { ...ruleR004, check: checkR004 },
  R005: { ...ruleR005, check: checkR005, checkCrossPage: checkR005Cross },
  R006: { ...ruleR006, check: checkR006 },
  R007: { ...ruleR007, check: checkR007 },
  R008: { ...ruleR008, check: checkR008 },
  R009: { ...ruleR009, check: checkR009, checkCrossPage: checkR009Cross },
  R010: { ...ruleR010, check: checkR010 },
};

/**
 * 运行扫描
 * @param {ArrayBuffer} pptxData
 * @param {string[]} ruleIds - 如 ['R002','R003','R004',...]
 * @param {Object} options
 * @param {Function} options.onProgress - 进度回调
 * @param {Function} options.isCancelled - 返回 boolean
 * @returns {Promise<{issues: Array, slideCount: number, duration: number, cancelled: boolean}>}
 */
export async function runScan(pptxData, ruleIds, options = {}) {
  const { onProgress, isCancelled } = options;
  const startTime = performance.now();
  const allIssues = [];

  function cancelled() { return isCancelled && isCancelled(); }

  // --- 阶段 1: 解析文件 ---
  report({ stage: 'parse', progress: 0, stageName: '解析文件', issues: { s1: 0, s2: 0, s3: 0, s4: 0 } });
  if (cancelled()) return abortResult();

  const zip = await JSZip.loadAsync(pptxData);
  const presInfo = await parsePptx(pptxData);
  const slideCount = presInfo.slideCount;
  if (cancelled()) return abortResult();

  report({ stage: 'parse', progress: 30, stageName: '解析文件', issues: { s1: 0, s2: 0, s3: 0, s4: 0 } });

  // --- 阶段 2: 加载所有幻灯片 ---
  report({ stage: 'load', progress: 0, stageName: '加载页面', issues: { s1: 0, s2: 0, s3: 0, s4: 0 } });

  const slides = [];
  for (let i = 0; i < slideCount; i++) {
    if (cancelled()) return abortResult();
    try {
      const slideXml = await loadSlide(zip, i);
      const texts = extractTexts(slideXml);
      const shapes = extractShapes(slideXml);
      slides.push({ index: i, page: i + 1, texts, shapes, hasHidden: false });
    } catch (e) {
      console.warn('[RuleEngine] 第 ' + (i + 1) + ' 页加载失败:', e.message);
      slides.push({ index: i, page: i + 1, texts: [], shapes: [], hasHidden: false, loadError: e.message });
    }
    report({
      stage: 'load', progress: Math.round((i + 1) / slideCount * 100),
      stageName: '加载页面', current: i + 1, total: slideCount,
      issues: { s1: 0, s2: 0, s3: 0, s4: 0 },
    });
  }

  // --- 阶段 3: 执行页面级检查 ---
  report({ stage: 'check', progress: 0, stageName: '执行检查', current: 0, total: slideCount, issues: { s1: 0, s2: 0, s3: 0, s4: 0 } });

  const sWords = store.get('sensitiveWords') || [];
  const context = { sensitiveWords: sWords, totalSlides: slideCount };

  for (let si = 0; si < slides.length; si++) {
    if (cancelled()) return { issues: allIssues, slideCount, duration: performance.now() - startTime, cancelled: true };
    const slide = slides[si];

    for (const ruleId of ruleIds) {
      const rule = ruleRegistry[ruleId];
      if (!rule || !rule.pageLevel) continue;
      try {
        const slideIssues = rule.check(slide, presInfo, context);
        for (const iss of slideIssues) { iss.ruleName = rule.name; allIssues.push(iss); }
      } catch (e) {
        console.warn('[RuleEngine] ' + ruleId + ' 第 ' + slide.page + ' 页检查失败:', e.message);
      }
    }

    report({
      stage: 'check', progress: Math.round((si + 1) / slides.length * 100),
      stageName: '执行检查', current: si + 1, total: slides.length,
      issues: countByLevel(allIssues),
    });
  }

  // --- 阶段 4: 跨页检查 ---
  const crossRules = ruleIds.filter(id => ruleRegistry[id]?.crossPage && ruleRegistry[id]?.checkCrossPage);
  if (crossRules.length > 0 && !cancelled()) {
    report({ stage: 'cross-check', progress: 0, stageName: '跨页检查', current: 0, total: crossRules.length, issues: countByLevel(allIssues) });
    for (let ci = 0; ci < crossRules.length; ci++) {
      if (cancelled()) break;
      const ruleId = crossRules[ci];
      const rule = ruleRegistry[ruleId];
      try {
        const crossIssues = rule.checkCrossPage(slides, presInfo);
        for (const iss of crossIssues) { iss.ruleName = rule.name; allIssues.push(iss); }
      } catch (e) {
        console.warn('[RuleEngine] ' + ruleId + ' 跨页检查失败:', e.message);
      }
      report({ stage: 'cross-check', progress: Math.round((ci + 1) / crossRules.length * 100), stageName: '跨页检查', current: ci + 1, total: crossRules.length, issues: countByLevel(allIssues) });
    }
  }

  // 检测 R010 空词库警告
  const r010EmptyWarning = ruleIds.includes('R010') && (!sWords || sWords.length === 0);

  // --- 完成 ---
  const duration = performance.now() - startTime;
  report({ stage: 'summary', progress: 100, stageName: '汇总结果', issues: countByLevel(allIssues), done: true });

  // 返回预览数据和幻灯片尺寸
  return {
    issues: allIssues,
    slideCount,
    duration,
    cancelled: false,
    slides: slides.map(s => ({
      page: s.page,
      texts: s.texts,
      shapes: s.shapes,
      loadError: s.loadError || null,
    })),
    presInfo: { width: presInfo.width, height: presInfo.height },
    r010EmptyWarning,
  };

  function abortResult() {
    return { issues: allIssues, slideCount, duration: performance.now() - startTime, cancelled: true };
  }

  function report(data) {
    if (onProgress) onProgress(data);
  }
}

function countByLevel(issues) {
  const counts = { s1: 0, s2: 0, s3: 0, s4: 0 };
  for (const i of issues) {
    if (counts[i.level] !== undefined) counts[i.level]++;
  }
  return counts;
}
