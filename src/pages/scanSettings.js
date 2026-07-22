/**
 * 扫描设置 — 模式选择 + 规则列表
 */
import { store } from '../store.js';
import { formatFileSize } from '../utils/download.js';

export function renderScanSettings(state) {
  const modeCards = [
    {k:'quick', icon:'ϟ', title:'快速检查', desc:'执行核心高风险规则，速度更快'},
    {k:'standard', icon:'◇', title:'标准检查', desc:'执行全部基础规则，完成全部基础检查'},
    {k:'custom', icon:'☷', title:'自定义检查', desc:'按模块选择本次规则'},
  ];
  const active = state.scanMode || 'quick';

  const modes = modeCards.map(m =>
    `<div class="card mode ${m.k === active ? 'selected' : ''}" id="mode-${m.k}" onclick="window.switchMode&&switchMode('${m.k}')">
      <div class="icon">${m.icon}</div>
      <h2>${m.title}</h2>
      <p class="muted">${m.desc}</p>
    </div>`
  ).join('');

  // Quick check rules
  const quickItems = [
    {n:'空白页面检查（R002）',d:'检测疑似空白页面'},
    {n:'页面外元素检查（R003）',d:'检测画布外残留元素'},
    {n:'字体一致性检查（R004）',d:'检查非标准字体 · 可自动修复'},
    {n:'文本溢出检查（R006）',d:'检查文字被截断或超出画布'},
    {n:'标题一致性检查（R009）',d:'检查标题样式与位置 · 可自动修复'},
    {n:'敏感及残留文本检查（R010）',d:'检测敏感词库中的词条'},
  ];
  const quickHTML = `<div id="panel-quick" class="rules-panel" style="display:${active==='quick'?'block':'none'}">
    <div class="card rules" style="grid-template-columns:1fr">
      <div class="rule-header">快速检查将执行以下 6 项核心规则（固定，不可调整）</div>
      ${quickItems.map(x => `<div class="rule">${x.n}<span class="muted" style="margin-left:12px">${x.d}</span></div>`).join('')}
      <div class="rule" style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px;color:var(--muted)">不执行：字号一致性（R005）、元素对齐（R007）、文字安全边距（R008）</div>
      <div class="rule" style="color:var(--muted)">规则版本：builtin-rules-v1.0（只读）</div>
    </div>
  </div>`;

  // Standard check rules
  const stdGroups = [
    {g:'文档基础健康',items:[{n:'空白页面检查（R002）',d:'检测疑似空白页面'},{n:'页面外元素检查（R003）',d:'检测画布外残留元素'}]},
    {g:'文本规范',items:[{n:'字体一致性检查（R004）',d:'非标准字体 · 可自动修复'},{n:'字号一致性检查（R005）',d:'字号过小及不一致 · 可自动修复'},{n:'文本溢出检查（R006）',d:'文字被截断或超出画布'},{n:'敏感及残留文本检查（R010）',d:'检测敏感词库词条'}]},
    {g:'版面布局',items:[{n:'元素对齐检查（R007）',d:'对齐偏差 · 可自动修复'},{n:'文字安全边距检查（R008）',d:'文字距边缘过近'}]},
    {g:'跨页一致性',items:[{n:'标题一致性检查（R009）',d:'标题样式与位置 · 可自动修复'}]},
  ];
  const stdHTML = `<div id="panel-standard" class="rules-panel" style="display:${active==='standard'?'block':'none'}">
    <div class="card rules" style="grid-template-columns:1fr;padding:0">
      ${stdGroups.map(g => `
        <div style="padding:16px 22px;border-bottom:1px solid var(--line)">
          <div style="font-weight:700;color:#455168;margin-bottom:6px">${g.g}</div>
          ${g.items.map(x => `<div class="rule" style="margin:2px 0">${x.n}<span class="muted" style="margin-left:12px">${x.d}</span></div>`).join('')}
        </div>`).join('')}
      <div style="padding:12px 22px;color:var(--muted);font-size:13px">规则版本：builtin-rules-v1.0（只读）</div>
    </div>
  </div>`;

  // Custom check rules
  const custItems = [
    {n:'空白页面检查（R002）',d:'检测疑似空白页面',f:false},
    {n:'页面外元素检查（R003）',d:'检测画布外残留元素',f:false},
    {n:'字体一致性检查（R004）',d:'非标准字体 · 可自动修复',f:true},
    {n:'字号一致性检查（R005）',d:'字号过小及不一致 · 可自动修复',f:true},
    {n:'文本溢出检查（R006）',d:'文字被截断或超出画布',f:false},
    {n:'元素对齐检查（R007）',d:'对齐偏差 · 可自动修复',f:true},
    {n:'文字安全边距检查（R008）',d:'文字距页面边缘过近',f:false},
    {n:'标题一致性检查（R009）',d:'标题样式与位置 · 可自动修复',f:true},
    {n:'敏感及残留文本检查（R010）',d:'检测敏感词库中的词条',f:false},
  ];
  const custHTML = `<div id="panel-custom" class="rules-panel" style="display:${active==='custom'?'block':'none'}">
    <div class="card rules" style="grid-template-columns:1fr;padding:0">
      <div style="padding:14px 22px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px">
        <span style="font-weight:700">自定义选择检查项</span>
        <span class="muted" id="customCount">已选 9/9</span>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn" style="height:32px;padding:0 14px;font-size:13px" onclick="document.querySelectorAll('.custom-ck').forEach(e=>{e.checked=true})">全选</button>
          <button class="btn" style="height:32px;padding:0 14px;font-size:13px" onclick="document.querySelectorAll('.custom-ck').forEach(e=>{e.checked=false})">全不选</button>
          <button class="btn" style="height:32px;padding:0 14px;font-size:13px">恢复默认</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;padding:10px 22px">
        ${custItems.map(x => `
          <div class="custom-rule-item">
            <label><input type="checkbox" class="custom-ck" checked><b style="font-size:14px">${x.n}</b></label>
            <div style="margin:2px 0 0 28px;font-size:13px;color:var(--muted)">${x.d}${x.f ? '' : '<span style="color:var(--muted)"> · 不支持自动修复</span>'}</div>
          </div>`).join('')}
      </div>
      <div style="padding:12px 22px;border-top:1px solid var(--line);color:var(--muted);font-size:13px">
        规则版本：builtin-rules-v1.0（只读）
        <span style="margin-left:24px">ⓘ 部分自定义扫描禁止自动修复，仅完整标准检查结果可修复</span>
      </div>
    </div>
  </div>`;

  return `
    <div class="heading">
      <div>
        <h1>扫描设置</h1>
        <div class="muted">选择扫描模式与本次执行规则</div>
      </div>
      <div class="toolbar">
        <button class="btn primary scan-start" onclick="startScan('${active}')">开始${ {quick:'快速检查',standard:'标准检查',custom:'自定义检查'}[active] || '扫描' }</button>
      </div>
    </div>
    <div class="card path">
      <b>${state.fileName || '未选择文件'}</b>
      <span class="muted">${state.fileSize ? formatFileSize(state.fileSize) : ''}${state.pageCount ? '　|　' + state.pageCount + ' 页' : ''}${state.fileName ? '　|　查看文件详情' : ''}</span>
    </div>
    <div class="grid mode-grid" style="margin-top:20px">
      ${modes}
    </div>
    ${quickHTML + stdHTML + custHTML}
  `;
}

/* 模式切换函数（挂载到 window 上供 onclick 调用） */
window.switchMode = function(m) {
  ['quick','standard','custom'].forEach(k => {
    const panel = document.getElementById('panel-' + k);
    if (panel) panel.style.display = k === m ? 'block' : 'none';
    const mode = document.getElementById('mode-' + k);
    if (mode) mode.className = 'card mode' + (k === m ? ' selected' : '');
  });
  updateScanButton(m);
};

function updateScanButton(mode) {
  const btn = document.querySelector('.scan-start');
  if (!btn) return;
  const labels = {quick:'开始快速检查', standard:'开始标准检查', custom:'开始自定义检查'};
  if (mode === 'custom') {
    const c = document.querySelectorAll('.custom-ck:checked').length;
    btn.textContent = (c > 0 ? '开始自定义检查（' + c + ' 项）' : '请选择检查项');
    btn.disabled = c === 0;
  } else {
    btn.textContent = labels[mode] || '开始扫描';
    btn.disabled = false;
  }
  btn.setAttribute('onclick', `startScan('${mode}')`);
}

/* 自定义模式复选框计数 + 同步按钮 */
window.updateCustomCount = function() {
  const cbs = document.querySelectorAll('.custom-ck');
  const checked = document.querySelectorAll('.custom-ck:checked').length;
  const el = document.getElementById('customCount');
  if (el) el.textContent = '已选 ' + checked + '/' + cbs.length;
  // 更新按钮文字和禁用状态
  const btn = document.querySelector('.scan-start');
  if (btn && document.getElementById('panel-custom')?.style.display !== 'none') {
    btn.textContent = (checked > 0 ? '开始自定义检查（' + checked + ' 项）' : '请选择检查项');
    btn.disabled = checked === 0;
  }
};

// 为自定义复选框绑定变更事件（在 DOM 渲染后）
window.bindCustomCheckboxes = function() {
  document.querySelectorAll('.custom-ck').forEach(cb => {
    cb.addEventListener('change', window.updateCustomCount);
  });
  window.updateCustomCount();
};

window.startScan = function(mode) {
  if (!store.get('pptxData')) {
    alert('请先导入一个 .pptx 文件');
    location.hash = 'home';
    return;
  }

  // 确定要执行的规则
  let rules = [];
  if (mode === 'custom') {
    const cbs = document.querySelectorAll('.custom-ck:checked');
    const idMap = { 0:'R002',1:'R003',2:'R004',3:'R005',4:'R006',5:'R007',6:'R008',7:'R009',8:'R010' };
    // 按自定义列表顺序提取 rule ID
    document.querySelectorAll('.custom-ck').forEach((cb, idx) => {
      if (cb.checked && idMap[idx]) rules.push(idMap[idx]);
    });
    if (rules.length === 0) {
      alert('请至少选择一项检查规则');
      return;
    }
  } else {
    const ruleMap = {
      quick: ['R002','R003','R004','R006','R009','R010'],
      standard: ['R002','R003','R004','R005','R006','R007','R008','R009','R010'],
    };
    rules = ruleMap[mode] || [];
  }

  // 防止扫描期间重复启动
  if (store.get('isScanning')) {
    alert('扫描正在进行中，请等待当前扫描完成');
    return;
  }

  // 重置扫描状态
  store.update({
    scanMode: mode,
    scanRules: rules,
    isScanning: true,
    scanProgress: { current: 0, total: 50, stage: '解析文件' },
    scanComplete: false,
    scanCancelled: false,
    issues: [],
    hasScanResult: false,
  });

  location.hash = 'scanning';
};

/* 渲染后：绑定自定义复选框事件、恢复默认按钮 */
export function afterRenderScanSettings() {
  window.bindCustomCheckboxes();

  // 恢复默认按钮：全选
  const restoreBtn = document.querySelector('button[onclick*="全选"]');
  // 按钮已经在 HTML onclick 中处理了全选/全不选
  // 额外添加 change 事件同步计数（全选/全不按钮通过 onclick 修改 checked，不会触发 change）
  const allBtns = document.querySelectorAll('.rules-panel .btn');
  allBtns.forEach(btn => {
    if (btn.textContent.includes('全选')) {
      btn.onclick = () => {
        document.querySelectorAll('.custom-ck').forEach(e => { e.checked = true; });
        window.updateCustomCount();
      };
    } else if (btn.textContent.includes('全不选')) {
      btn.onclick = () => {
        document.querySelectorAll('.custom-ck').forEach(e => { e.checked = false; });
        window.updateCustomCount();
      };
    } else if (btn.textContent.includes('恢复默认')) {
      btn.onclick = () => {
        document.querySelectorAll('.custom-ck').forEach(e => { e.checked = true; });
        window.updateCustomCount();
      };
    }
  });

  // 同步按钮状态（自定义模式时更新文字和禁用）
  const activeMode = document.querySelector('.mode.selected')?.id?.replace('mode-', '') || 'quick';
  if (activeMode === 'custom') updateScanButton('custom');
}
