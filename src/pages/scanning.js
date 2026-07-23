/**
 * 扫描中 — 进度展示 + 实际扫描执行
 *
 * afterRenderScanning 启动异步扫描，实时更新 UI。
 * 支持取消：3 秒内停止调度新任务。
 */

let _cancelFlag = false;
let _scanRunning = false;

export function renderScanning(state) {
  const prog = state.scanProgress || {};
  // 步骤映射：cross-check 仍属"执行检查"阶段
  const stepMap = { parse: 0, load: 1, check: 2, 'cross-check': 2, summary: 3 };
  const displayStep = stepMap[prog.stage] !== undefined ? stepMap[prog.stage] : 0;
  const isDone = state.scanComplete;
  const isCancel = state.scanCancelled;
  const steps = ['解析文件', '生成页面预览', '执行检查', '汇总结果'];
  const iss = prog.issues || { s1: 0, s2: 0, s3: 0, s4: 0 };
  const pct = isDone ? 100 : isCancel ? 0 : (prog.progress || 0);
  const cur = prog.current || 0;
  const tot = prog.total || 0;

  // 规则名称列表
  const ruleNames = {
    R002: '空白页面检查', R003: '页面外元素检查', R004: '字体一致性检查',
    R006: '元素对齐检查',
    R008: '标题一致性检查', R009: '敏感及残留文本检查',
  };
  const activeRules = state.scanRules || [];
  // 从 store 获取显示用顺序列表
  const displayRules = {
    quick: ['R002', 'R003', 'R004', 'R008', 'R009'],
    standard: ['R002', 'R003', 'R004', 'R006', 'R007', 'R008', 'R009'],
  };
  const orderedRules = displayRules[state.scanMode] || activeRules;

  return `
    <div class="heading">
      <div>
        <h1>${isCancel ? '正在取消...' : isDone ? '扫描完成' : '正在扫描'}</h1>
        <div class="muted">${state.fileName || ''}</div>
      </div>
      <div class="toolbar">
        ${isDone || isCancel ? '' : '<button class="btn danger" id="cancelScanBtn" onclick="window.cancelScan()">取消扫描</button>'}
      </div>
    </div>
    <div class="progress-steps">
      ${steps.map((x, i) => `
        <div class="step ${i < displayStep || (i === displayStep && isDone) ? 'done' : i === displayStep && !isDone ? 'current' : ''}">
          <b>${i < displayStep || (i === displayStep && isDone) ? '✓' : i + 1}</b>${x}
        </div>`).join('')}
    </div>
    <b id="scanStatusText">${isDone ? '扫描已完成' : isCancel ? '正在结束当前任务...' : cur > 0 ? '正在检查第 ' + cur + '/' + tot + ' 页' : prog.stageName || '正在扫描...'}</b>
    <div class="progress" style="margin:14px 0">
      <span id="scanProgressBar" style="width:${pct}%"></span>
    </div>
    <div class="grid scan-cols">
      <div class="card checklist" id="scanChecklist">
        ${orderedRules.map(rid => `
          <div class="check" id="chk-${rid}"><span>${ruleNames[rid] || rid}</span><span class="muted" style="margin-left:auto">等待中</span></div>
        `).join('')}
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr">
        ${[['S1 严重', iss.s1, 's1'], ['S2 高风险', iss.s2, 's2'], ['S3 一般', iss.s3, 's3'], ['S4 建议', iss.s4, 's4']]
          .map(x => `<div class="card stat"><span class="badge ${x[2]}">${x[0]}</span><strong id="count-${x[2]}">${x[1]}</strong></div>`).join('')}
      </div>
    </div>
  `;
}

/* 取消扫描 */
window.cancelScan = function () {
  _cancelFlag = true;
  const btn = document.getElementById('cancelScanBtn');
  if (btn) { btn.disabled = true; btn.textContent = '正在取消'; }
  // 3 秒后跳转（保证当前任务安全结束）
  setTimeout(() => {
    if (_scanRunning) {
      store.update({ scanCancelled: true, scanComplete: false, isScanning: false });
      location.hash = 'scan-result';
    }
  }, 3000);
};

/* afterRender — 启动扫描 */
import { store } from '../store.js';
import { runScan } from '../core/ruleEngine.js';

export function afterRenderScanning(state) {
  // 已完成的扫描不再启动
  if (state.scanComplete || _scanRunning) return;

  const pptxData = state.pptxData;
  if (!pptxData) {
    location.hash = 'home';
    return;
  }

  _scanRunning = true;
  _cancelFlag = false;

  // 异步执行扫描
  executeScan(pptxData, state.scanRules || []);
}

async function executeScan(pptxData, ruleIds) {
  try {
    const result = await runScan(pptxData, ruleIds, {
      onProgress: updateProgressUI,
      isCancelled: () => _cancelFlag,
    });

    // 标记完成
    _scanRunning = false;

    if (result.cancelled) {
      store.update({
        isScanning: false,
        scanComplete: false,
        scanCancelled: true,
        issues: result.issues,
        hasScanResult: true,
        slidePreviews: result.slides || [],
        presInfo: result.presInfo || { width: 12192000, height: 6858000 },
        r009EmptyWarning: result.r009EmptyWarning || false,
        scanProgress: { stage: 'summary', progress: 0, stageName: '已取消', issues: countByLevel(result.issues), done: true },
      });
    } else {
      store.update({
        isScanning: false,
        scanComplete: true,
        scanCancelled: false,
        issues: result.issues,
        hasScanResult: true,
        slidePreviews: result.slides || [],
        presInfo: result.presInfo || { width: 12192000, height: 6858000 },
        r009EmptyWarning: result.r009EmptyWarning || false,
        scanResult: { slideCount: result.slideCount, duration: result.duration, totalIssues: result.issues.length, completedAt: new Date().toLocaleString('zh-CN') },
        scanProgress: { stage: 'summary', progress: 100, stageName: '扫描完成', issues: countByLevel(result.issues), done: true },
      });
    }

    // 短暂停留让用户看到完成状态，然后跳转
    setTimeout(() => {
      location.hash = 'scan-result';
    }, 600);

  } catch (e) {
    console.error('[Scan] 扫描失败:', e);
    _scanRunning = false;
    store.update({
      isScanning: false,
      scanComplete: true,
      issues: [],
      hasScanResult: true,
    });
    location.hash = 'scan-result';
  }
}

/* 更新 UI */
function updateProgressUI(prog) {
  // 更新 store（供后续渲染使用）
  store.update({ scanProgress: prog });

  // 更新进度条
  const bar = document.getElementById('scanProgressBar');
  if (bar) bar.style.width = (prog.progress || 0) + '%';

  // 更新状态文字
  const status = document.getElementById('scanStatusText');
  if (status) {
    if (prog.stage === 'check' && prog.current > 0) {
      status.textContent = '正在检查第 ' + prog.current + '/' + prog.total + ' 页';
    } else if (prog.stage === 'load' && prog.current > 0) {
      status.textContent = '正在加载第 ' + prog.current + '/' + prog.total + ' 页';
    } else {
      status.textContent = prog.stageName || '正在扫描...';
    }
  }

  // 更新步骤
  const stepMap = { parse: 0, load: 1, check: 2, 'cross-check': 2, summary: 3 };
  if (prog.stage && stepMap[prog.stage] !== undefined) {
    const steps = document.querySelectorAll('.step');
    const doneIdx = stepMap[prog.stage];
    steps.forEach((el, i) => {
      const completed = i < doneIdx || (i === doneIdx && prog.done);
      el.className = 'step' + (completed ? ' done' : i === doneIdx ? ' current' : '');
      const b = el.querySelector('b');
      if (b) b.textContent = completed ? '✓' : String(i + 1);
    });
  }

  // 更新检查列表（完成的规则标记）
  if (prog.stage === 'check' && prog.current > 0) {
    updateChecklist('检查中');
  } else if (prog.stage === 'cross-check' || (prog.stage === 'summary' && !prog.done)) {
    // 页面级检查完成 → 标记所有规则为"已完成"
    updateChecklist('已完成');
  } else if (prog.done) {
    updateChecklist('已完成');
  }

  // 更新问题计数
  if (prog.issues) {
    for (const level of ['s1', 's2', 's3', 's4']) {
      const el = document.getElementById('count-' + level);
      if (el) el.textContent = prog.issues[level] || 0;
    }
  }
}

let _lastCheckUpdate = 0;
function updateChecklist(status) {
  const checks = document.querySelectorAll('.check');
  checks.forEach(el => {
    const span = el.querySelector('.muted');
    if (!span) return;
    if (status === '已完成') {
      span.textContent = '已完成';
      el.querySelector('span:first-child').textContent = '✓';
    } else if (span.textContent === '等待中') {
      span.textContent = '检查中...';
    }
  });
}

function countByLevel(issues) {
  const counts = { s1: 0, s2: 0, s3: 0, s4: 0 };
  for (const i of issues) {
    if (counts[i.level] !== undefined) counts[i.level]++;
  }
  return counts;
}
