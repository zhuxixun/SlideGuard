/**
 * 修复结果 — 显示修复完成状态、对比数据和下载信息
 */
export function renderFixResult(state) {
  const fr = state.fixResult || {};
  const fixed = fr.fixedCount || 0;
  const failed = fr.failedCount || 0;
  const errors = fr.errors || [];

  return `
    <div class="success">
      <div class="tick" style="color:${fixed > 0 ? 'var(--green)' : 'var(--orange)'}">${fixed > 0 ? '●✓' : '○—'}</div>
      <h1>${fixed > 0 ? '修复完成' : '修复未完成'}</h1>
      <p class="muted">${fr.fileName ? '文件已保存为新文件，原始文件保持不变' : '修复过程中出现问题，请查看下方错误信息'}</p>
      <div class="input" style="width:850px;margin:auto;text-align:center;justify-content:center">${fr.fileName || '修复未生成文件'}</div>
    </div>
    <div class="grid fix-result-grid">
      ${[['已修复', String(fixed), 'ok'], ['未修复', String(failed), 's3']]
        .map(x => `<div class="card stat"><span class="badge ${x[2]}">${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}
    </div>
    ${errors.length > 0 ? `
    <div class="info" style="margin-bottom:18px;color:#9b5b00;border-color:#f2c879;background:#fff9e8">
      <b>修复警告</b><br>
      ${errors.map(e => '· ' + e).join('<br>')}
    </div>` : ''}
    <div class="footer" style="margin-top:22px">
      <button class="btn" onclick="location.hash='issue-list'">查看剩余问题</button>
      <button class="btn primary" onclick="location.hash='home'">返回首页</button>
    </div>
  `;
}
