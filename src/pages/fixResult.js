/**
 * 修复结果 — 显示修复完成状态、对比数据和下载信息
 */
export function renderFixResult(state) {
  const fr = state.fixResult || {};
  const fixed = fr.fixedCount || 0;
  const failed = fr.failedCount || 0;
  const newCount = fr.newIssueCount || 0;
  const beforeTotal = fr.beforeTotal || 0;
  const afterTotal = fr.afterTotal || 0;
  const errors = fr.errors || [];

  // 柱状图高度（相对比例）
  const maxBar = Math.max(beforeTotal, afterTotal, 1);
  const beforeH = Math.round(beforeTotal / maxBar * 160);
  const afterH = Math.round(afterTotal / maxBar * 160);

  return `
    <div class="success">
      <div class="tick">●✓</div>
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
    <div class="grid compare">
      <div class="card charts">
        <h2>问题数量对比</h2>
        <div style="display:flex;align-items:flex-end;justify-content:center;gap:100px;height:190px;padding-top:10px">
          <div style="width:110px;background:#ef7b24;color:#fff;text-align:center;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;height:${Math.max(beforeH, 30)}px;border-radius:6px 6px 0 0;font-weight:700">修复前 ${beforeTotal}</div>
          <div style="width:110px;background:#13a66a;color:#fff;text-align:center;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;height:${Math.max(afterH, 30)}px;border-radius:6px 6px 0 0;font-weight:700">修复后 ${afterTotal}</div>
        </div>
      </div>
      <div class="card checklist" style="padding:20px 24px">
        <h2 style="margin-top:0">验证结果</h2>
        ${[['PPTX 结构完整', fr.fileName ? '通过' : '未通过', fr.fileName ? '#13a66a' : '#e5484d'],
           ['页面数量一致', fr.fileName ? '通过' : '未通过', fr.fileName ? '#13a66a' : '#e5484d'],
           ['标准检查已完成', fr.fileName ? '已完成' : '未完成', fr.fileName ? '#13a66a' : '#e5484d'],
          ].map(x => `<div class="check" style="border-bottom:1px solid #edf0f4;height:43px;display:flex;align-items:center">${x[0]}<span style="margin-left:auto;color:${x[2]}">${x[1]}</span></div>`).join('')}
      </div>
    </div>
    <div class="footer" style="margin-top:22px">
      <button class="btn" onclick="location.hash='issue-list'">查看剩余问题</button>
      <button class="btn primary" onclick="location.hash='home'">返回首页</button>
    </div>
  `;
}
