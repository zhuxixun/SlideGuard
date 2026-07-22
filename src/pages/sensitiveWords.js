/**
 * 敏感词库 — 词条管理 + 保存前确认
 *
 * 修改不立即生效，点击"保存"后显示新增/修改/删除数量，确认后写入 localStorage。
 */
import { store } from '../store.js';

const STORAGE_KEY = 'slideguard-sensitive-words';

/** 从 localStorage 加载持久化词库 */
function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) return p; }
  } catch (e) { /* ignore */ }
  // 无持久化数据时清空，让用户首次自行添加
  return [];
}

/** 持久化到 localStorage + store */
function persist(words) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  store.set('sensitiveWords', words);
}

/** 计算 pending 相对 original 的变化 */
function calcDiff(original, pending) {
  const adds = [], dels = [], edits = [];
  // 找新增和编辑
  for (let i = 0; i < pending.length; i++) {
    const pw = pending[i];
    const oi = original.indexOf(pw);
    if (oi === -1) {
      // 可能是新增，也可能是从其他位置编辑来的
      // 检查 original 中是否有 old value（借助位置试探）
      if (i < original.length && original[i] !== pw) {
        edits.push({ old: original[i], new: pw });
      } else if (i >= original.length) {
        adds.push(pw);
      } else {
        // i < original.length && original[i] === pw → 未变化
      }
    }
  }
  // 找删除
  for (const ow of original) {
    if (!pending.includes(ow)) dels.push(ow);
  }
  // 补漏：如果位置变化导致新增/编辑判断不准，用更简单的方式
  // 数量变多 = 有新增
  if (adds.length === 0 && pending.length > original.length) {
    // 简单比较：多出来的就是新增
    for (const pw of pending) {
      if (!original.includes(pw)) adds.push(pw);
    }
  }
  if (dels.length === 0 && pending.length < original.length) {
    for (const ow of original) {
      if (!pending.includes(ow)) dels.push(ow);
    }
  }
  return { added: adds.length, deleted: dels.length, edited: edits.length };
}

/** 初始化词库 */
if (!window._swOriginal) {
  const persisted = loadPersisted();
  window._swOriginal = [...persisted];
  window._swPending = [...persisted];
  store.set('sensitiveWords', persisted);
}

export function renderSensitiveWords(state) {
  const pending = window._swPending || [];
  const diff = calcDiff(window._swOriginal || [], pending);

  return `
    <div class="heading">
      <div>
        <h1>敏感词库</h1>
        <div class="muted">管理本机敏感词条，共 ${pending.length} 条${(diff.added + diff.deleted + diff.edited) > 0 ? '（有未保存的修改）' : ''}</div>
      </div>
      <div class="toolbar">
        <button class="btn" onclick="window._swCancel()">取消</button>
        <button class="btn primary" id="swSaveBtn" ${(diff.added + diff.deleted + diff.edited) === 0 ? 'disabled' : ''}>${(diff.added + diff.deleted + diff.edited) > 0 ? '保存（' + (diff.added + diff.deleted + diff.edited) + ' 项修改）' : '保存'}</button>
      </div>
    </div>
    <div class="info">ⓘ 本词库仅保存在本机浏览器中，不会上传或访问互联网。修改后需点击"保存"才能生效。</div>
    <div class="toolbar" style="margin:20px 0">
      <div class="input" style="width:420px;display:flex;align-items:center;gap:6px">
        <span>🔍</span>
        <input type="text" id="swSearchInput" placeholder="搜索词条" style="border:none;outline:none;flex:1;font-family:inherit;font-size:14px;background:transparent">
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" id="swAddInput" placeholder="输入新词条" style="height:38px;padding:0 12px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:14px;width:200px">
        <button class="btn primary" id="swAddBtn">新增词条</button>
      </div>
      <button class="btn" id="swBatchBtn">批量粘贴</button>
      <span class="muted" id="swCount">共 ${pending.length} 条</span>
    </div>
    <div class="card" id="swTableContainer">
      <table class="table" id="swTable">
        <thead>
          <tr><th style="width:40%">词条</th><th style="width:25%">状态</th><th style="width:120px">操作</th></tr>
        </thead>
        <tbody id="swTbody">
          ${renderRows(pending, '', window._swOriginal || [])}
        </tbody>
      </table>
      ${pending.length === 0 ? '<div style="padding:40px;text-align:center;color:var(--muted)">暂无词条，输入词条后点击"新增"添加</div>' : ''}
    </div>
    <!-- 批量粘贴弹窗 -->
    <div id="swBatchOverlay" style="display:none;position:fixed;inset:0;background:#00000044;z-index:100;align-items:center;justify-content:center">
      <div class="card" style="width:520px;padding:24px;position:relative">
        <h2 style="margin:0 0 12px">批量粘贴词条</h2>
        <p class="muted" style="margin:0 0 12px">每行一个词条，保存时自动去除首尾空白、忽略空行并合并重复词条</p>
        <textarea id="swBatchTextarea" style="width:100%;height:200px;border:1px solid var(--line);border-radius:8px;padding:12px;font-family:inherit;font-size:14px;resize:vertical" placeholder="每行一个词条&#10;例如：&#10;机密&#10;绝密&#10;内部资料"></textarea>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
          <button class="btn" id="swBatchCancel">取消</button>
          <button class="btn primary" id="swBatchConfirm">确认添加</button>
        </div>
      </div>
    </div>
    <!-- 保存确认弹窗 -->
    <div id="swConfirmOverlay" style="display:none;position:fixed;inset:0;background:#00000044;z-index:100;align-items:center;justify-content:center">
      <div class="card" style="width:460px;padding:28px;position:relative;text-align:center">
        <h2 style="margin:0 0 16px">确认保存修改</h2>
        <div style="display:flex;gap:20px;justify-content:center;margin-bottom:20px">
          <div style="background:#e5f8ef;border-radius:12px;padding:16px 20px;min-width:80px"><div style="font-size:28px;font-weight:800;color:#13a66a">${diff.added}</div><div style="font-size:13px;color:#087a4b">新增</div></div>
          <div style="background:#fff5d9;border-radius:12px;padding:16px 20px;min-width:80px"><div style="font-size:28px;font-weight:800;color:#e5a11a">${diff.edited}</div><div style="font-size:13px;color:#a66c00">修改</div></div>
          <div style="background:#ffebed;border-radius:12px;padding:16px 20px;min-width:80px"><div style="font-size:28px;font-weight:800;color:#e5484d">${diff.deleted}</div><div style="font-size:13px;color:#b8242a">删除</div></div>
        </div>
        <p class="muted">保存后修改立即生效，不可撤回</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="btn" id="swConfirmCancel">取消</button>
          <button class="btn primary" id="swConfirmOk">确认保存</button>
        </div>
      </div>
    </div>
  `;
}

function renderRows(pending, search, original) {
  const q = search.trim().toLowerCase();
  const filtered = q ? pending.map((w, i) => ({ w, i })).filter(x => x.w.toLowerCase().includes(q)) : pending.map((w, i) => ({ w, i }));
  if (filtered.length === 0) return '<tr><td colspan="3" style="text-align:center;color:var(--muted)">无匹配词条</td></tr>';
  return filtered.map(({ w, i }) => {
    const isNew = !original.includes(w);
    const isDel = original.includes(w) && !pending.includes(w);
    const isEdit = i < original.length && original[i] !== w && !isNew;
    const status = isNew ? '新增' : isEdit ? '已修改' : '—';
    const statusColor = isNew ? '#13a66a' : isEdit ? '#e5a11a' : 'var(--muted)';
    return `<tr>
      <td><b>${escapeHtml(w)}</b></td>
      <td style="color:${statusColor}">${status}</td>
      <td>
        <span style="color:#1f5eff;cursor:pointer" onclick="window._swEdit(${i})">编辑</span>
        &nbsp;
        <span style="color:#e5484d;cursor:pointer" onclick="window._swDelete(${i})">删除</span>
      </td>
    </tr>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── CRUD（操作 pending 数组） ── */

window._swAdd = function() {
  const input = document.getElementById('swAddInput');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  const pending = window._swPending || [];
  if (pending.includes(val)) { alert('词条已存在'); return; }
  pending.push(val);
  window._swPending = pending;
  input.value = '';
  swRefresh();
};

window._swEdit = function(idx) {
  const pending = window._swPending || [];
  const overlay = document.getElementById('swEditOverlay');
  const input = document.getElementById('swEditInput');
  if (!overlay || !input) return;
  input.value = pending[idx];
  input.dataset.idx = idx;
  overlay.style.display = 'flex';
};

window._swDelete = function(idx) {
  if (!confirm('确认删除该词条？')) return;
  const pending = window._swPending || [];
  pending.splice(idx, 1);
  window._swPending = pending;
  swRefresh();
};

window._swBatch = function() {
  const overlay = document.getElementById('swBatchOverlay');
  if (overlay) overlay.style.display = 'flex';
};

window._swCancel = function() {
  const pending = window._swPending || [];
  const orig = window._swOriginal || [];
  const diff = calcDiff(orig, pending);
  if (diff.added + diff.deleted + diff.edited > 0) {
    if (!confirm('有未保存的修改，确定要放弃吗？')) return;
  }
  // 恢复原始
  window._swPending = [...orig];
  location.hash = 'scan-settings';
};

/* ── 渲染刷新 ── */

function swRefresh() {
  const pending = window._swPending || [];
  const orig = window._swOriginal || [];
  const searchEl = document.getElementById('swSearchInput');
  const search = searchEl ? searchEl.value : '';
  const tbody = document.getElementById('swTbody');
  const count = document.getElementById('swCount');
  if (tbody) tbody.innerHTML = renderRows(pending, search, orig);
  if (count) count.textContent = '共 ' + pending.length + ' 条';

  // 更新标题
  const diff = calcDiff(orig, pending);
  const hasChanges = (diff.added + diff.deleted + diff.edited) > 0;
  const muted = document.querySelector('.heading .muted');
  if (muted) muted.textContent = '管理本机敏感词条，共 ' + pending.length + ' 条' + (hasChanges ? '（有未保存的修改）' : '');

  // 更新保存按钮
  const saveBtn = document.getElementById('swSaveBtn');
  if (saveBtn) {
    const total = diff.added + diff.deleted + diff.edited;
    saveBtn.disabled = total === 0;
    saveBtn.textContent = total > 0 ? '保存（' + total + ' 项修改）' : '保存';
  }
}

/* ── afterRender ── */

export function afterRenderSensitiveWords() {
  // 添加
  const addBtn = document.getElementById('swAddBtn');
  if (addBtn) addBtn.addEventListener('click', () => window._swAdd());
  const addInput = document.getElementById('swAddInput');
  if (addInput) addInput.addEventListener('keydown', e => { if (e.key === 'Enter') window._swAdd(); });

  // 搜索
  const searchInput = document.getElementById('swSearchInput');
  if (searchInput) searchInput.addEventListener('input', () => swRefresh());

  // 批量粘贴
  const batchBtn = document.getElementById('swBatchBtn');
  const batchOverlay = document.getElementById('swBatchOverlay');
  const batchCancel = document.getElementById('swBatchCancel');
  const batchConfirm = document.getElementById('swBatchConfirm');
  const batchTextarea = document.getElementById('swBatchTextarea');
  if (batchBtn && batchOverlay) batchBtn.addEventListener('click', () => { batchOverlay.style.display = 'flex'; });
  if (batchCancel && batchOverlay) batchCancel.addEventListener('click', () => { batchOverlay.style.display = 'none'; });
  if (batchConfirm && batchTextarea && batchOverlay) {
    batchConfirm.addEventListener('click', () => {
      const val = batchTextarea.value;
      if (!val.trim()) { alert('请输入词条'); return; }
      const rawLines = val.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      const unique = [...new Set(rawLines)];
      const pending = window._swPending || [];
      const newWords = unique.filter(w => !pending.includes(w));
      if (newWords.length === 0) { alert('所有词条均已存在'); return; }
      pending.push(...newWords);
      window._swPending = pending;
      batchTextarea.value = '';
      batchOverlay.style.display = 'none';
      swRefresh();
    });
  }

  // 批量遮罩关闭
  if (batchOverlay) batchOverlay.addEventListener('click', e => { if (e.target === batchOverlay) batchOverlay.style.display = 'none'; });

  // 编辑弹窗
  const editOverlay = document.getElementById('swEditOverlay');
  if (!editOverlay) {
    // 动态创建编辑弹窗（模板中未包含，需要时创建）
    const div = document.createElement('div');
    div.id = 'swEditOverlay';
    div.style.cssText = 'display:none;position:fixed;inset:0;background:#00000044;z-index:100;align-items:center;justify-content:center';
    div.innerHTML = `<div class="card" style="width:420px;padding:24px;position:relative">
      <h2 style="margin:0 0 12px">编辑词条</h2>
      <input type="text" id="swEditInput" style="width:100%;height:42px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font-family:inherit;font-size:14px">
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
        <button class="btn" id="swEditCancel">取消</button>
        <button class="btn primary" id="swEditConfirm">保存</button>
      </div>
    </div>`;
    document.body.appendChild(div);
  }
  const swEditOverlay = document.getElementById('swEditOverlay');
  const editCancel = document.getElementById('swEditCancel');
  const editConfirm = document.getElementById('swEditConfirm');
  const editInput = document.getElementById('swEditInput');

  if (editCancel && swEditOverlay) editCancel.addEventListener('click', () => { swEditOverlay.style.display = 'none'; });
  if (editConfirm && editInput && swEditOverlay) {
    editConfirm.addEventListener('click', () => {
      const idx = parseInt(editInput.dataset.idx);
      const val = editInput.value.trim();
      if (!val) { alert('词条不能为空'); return; }
      const pending = window._swPending || [];
      if (pending.includes(val) && pending[idx] !== val) { alert('词条已存在'); return; }
      pending[idx] = val;
      window._swPending = pending;
      swEditOverlay.style.display = 'none';
      swRefresh();
    });
  }
  if (swEditOverlay) swEditOverlay.addEventListener('click', e => { if (e.target === swEditOverlay) swEditOverlay.style.display = 'none'; });

  // 保存按钮 → 显示确认弹窗
  const saveBtn = document.getElementById('swSaveBtn');
  const confirmOverlay = document.getElementById('swConfirmOverlay');
  if (saveBtn && confirmOverlay) {
    saveBtn.addEventListener('click', () => {
      const pending = window._swPending || [];
      const orig = window._swOriginal || [];
      const diff = calcDiff(orig, pending);
      if (diff.added + diff.deleted + diff.edited === 0) return;
      // 更新弹窗中的计数
      confirmOverlay.innerHTML = `<div class="card" style="width:460px;padding:28px;position:relative;text-align:center">
        <h2 style="margin:0 0 16px">确认保存修改</h2>
        <div style="display:flex;gap:20px;justify-content:center;margin-bottom:20px">
          <div style="background:#e5f8ef;border-radius:12px;padding:16px 20px;min-width:80px"><div style="font-size:28px;font-weight:800;color:#13a66a">${diff.added}</div><div style="font-size:13px;color:#087a4b">新增</div></div>
          <div style="background:#fff5d9;border-radius:12px;padding:16px 20px;min-width:80px"><div style="font-size:28px;font-weight:800;color:#e5a11a">${diff.edited}</div><div style="font-size:13px;color:#a66c00">修改</div></div>
          <div style="background:#ffebed;border-radius:12px;padding:16px 20px;min-width:80px"><div style="font-size:28px;font-weight:800;color:#e5484d">${diff.deleted}</div><div style="font-size:13px;color:#b8242a">删除</div></div>
        </div>
        <p class="muted">保存后修改立即生效，不可撤回</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="btn" id="swConfirmCancel">取消</button>
          <button class="btn primary" id="swConfirmOk">确认保存</button>
        </div>
      </div>`;
      confirmOverlay.style.display = 'flex';

      // 绑定确认按钮
      document.getElementById('swConfirmOk').addEventListener('click', () => {
        persist(pending);
        window._swOriginal = [...pending];
        confirmOverlay.style.display = 'none';
        swRefresh();
      });
      document.getElementById('swConfirmCancel').addEventListener('click', () => {
        confirmOverlay.style.display = 'none';
      });
    });
  }
  if (confirmOverlay) confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) confirmOverlay.style.display = 'none'; });
}
