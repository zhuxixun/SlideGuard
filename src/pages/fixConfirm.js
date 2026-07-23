/**
 * 修复确认 — 展示选中问题、修改项预览
 */
import { store } from '../store.js';
import { fixIssues, downloadFixedFile } from '../core/fixEngine.js';
import { runScan } from '../core/ruleEngine.js';

export function renderFixConfirm(state) {
  const issues = state.issues || [];
  const selected = state.selectedIssues || new Set();
  const fixable = issues.filter((x, i) => selected.has(i) && x.fixable);
  const pages = new Set(fixable.map(x => x.page));
  const typeMap = { R004: '字体替换', R006: '位置调整', R008: '样式修复' };

  return `
    <div class="heading">
      <div>
        <h1>修复确认</h1>
        <div class="muted">确认修改内容与输出文件 · 共 ${fixable.length} 个可修复问题</div>
      </div>
      <div class="toolbar">
        <button class="btn" onclick="location.hash='issue-list'">返回</button>
        <button class="btn primary" id="fixConfirmBtn">确认修复</button>
      </div>
    </div>
    ${fixable.length === 0 ? `
    <div class="card empty-state" style="margin-top:40px;padding:60px;text-align:center">
      <div class="empty-icon">◇</div>
      <h2>选中项中无可修复的问题</h2>
      <p class="muted">只有字体、对齐、标题样式问题可自动修复</p>
      <button class="btn primary" onclick="location.hash='issue-list'">返回问题列表</button>
    </div>` : `
    <div class="grid fix-grid">
      ${[['已选择', fixable.length + ' 个问题'], ['涉及', pages.size + ' 页'], ['预计修改', fixable.length + ' 个对象']]
        .map(x => `<div class="card stat">${x[0]}<strong>${x[1]}</strong></div>`).join('')}
    </div>
    <div class="info">ⓘ 原始文件始终保留，修复结果将保存为新文件并通过浏览器下载</div>
    <div class="card" style="margin-top:18px">
      <table class="table">
        <thead>
          <tr><th>页码</th><th>对象</th><th>修改类型</th><th>原值</th><th>目标值</th></tr>
        </thead>
        <tbody>
          ${fixable.map(x => `
            <tr>
              <td>${x.page}</td>
              <td>${x.object || x.rule || ''}</td>
              <td>${typeMap[x.rule] || x.rule || '自动修复'}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.actual || '-'}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.expected || '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="card path">
      <b>输出文件名</b>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
        <input type="text" id="fixOutputName" value="${(state.fileName || 'presentation').replace(/\.pptx$/i,'')}_SlideGuard_fixed_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_000000.pptx" style="flex:1;height:42px;padding:0 13px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:14px">
      </div>
      <p class="muted" style="margin-top:8px">将生成新文件并通过浏览器下载，不会修改原文件。文件名可修改前缀部分。</p>
    </div>`}
  `;
}

export function afterRenderFixConfirm() {
  const btn = document.getElementById('fixConfirmBtn');
  if (!btn) return;

  btn.addEventListener('click', async function() {
    btn.disabled = true;
    btn.textContent = '正在修复...';

    const pptxData = store.get('pptxData');
    const issues = store.get('issues') || [];
    const selected = store.get('selectedIssues') || new Set();
    const toFix = issues.filter((x, i) => selected.has(i) && x.fixable);

    if (!pptxData || toFix.length === 0) {
      alert('没有可修复的问题');
      btn.disabled = false;
      btn.textContent = '确认修复';
      return;
    }

    try {
      const result = await fixIssues(pptxData, toFix);

      if (result.buffer) {
        // 验证完成后重新扫描
        const fileName = document.getElementById('fixOutputName')?.value || store.get('fileName') || 'presentation.pptx';

        // 下载文件
        const downloadedName = downloadFixedFile(result.buffer, fileName);

        // 对修复后文件做标准扫描验证
        const verifyResult = await runScan(result.buffer, ['R002','R003','R004','R005','R006','R007','R008','R009'], {
          onProgress: () => {},
          isCancelled: () => false,
        });

        // 计算新增问题（对比修复前）
        const fixedIds = new Set(toFix.map((_, i) => issues.indexOf(toFix[i])));
        const newIssues = verifyResult.issues.filter(vi => {
          // 粗略去重：不在原问题列表中
          return !issues.some(oi => oi.rule === vi.rule && oi.page === vi.page && oi.desc === vi.desc);
        });

        store.update({
          fixResult: {
            fileName: downloadedName,
            fixedCount: result.fixed,
            failedCount: result.failed,
            errors: result.errors.slice(0, 5),
            newIssueCount: newIssues.length,
            beforeTotal: issues.length,
            afterTotal: verifyResult.issues.length,
            newIssues: newIssues.slice(0, 20),
          },
          issues: verifyResult.issues,
          pptxData: result.buffer, // 更新缓存，后续修复基于新文件
          slidePreviews: verifyResult.slides || [],
          presInfo: verifyResult.presInfo || { width: 12192000, height: 6858000 },
          hasScanResult: true,
        });
      } else {
        store.update({
          fixResult: {
            fileName: null,
            fixedCount: 0,
            failedCount: toFix.length,
            errors: result.errors.slice(0, 5),
            newIssueCount: 0,
            beforeTotal: issues.length,
            afterTotal: issues.length,
            newIssues: [],
          },
        });
      }

      location.hash = 'fix-result';
    } catch (e) {
      console.error('[Fix] 修复失败:', e);
      alert('修复过程出错：' + e.message);
      btn.disabled = false;
      btn.textContent = '确认修复';
    }
  });
}
