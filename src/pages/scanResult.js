/**
 * 扫描结果概览
 */
export function renderScanResult(state) {
  const issues = state.issues || [];
  const countS1 = issues.filter(i => i.level === 's1').length;
  const countS2 = issues.filter(i => i.level === 's2').length;
  const countS3 = issues.filter(i => i.level === 's3').length;
  const countS4 = issues.filter(i => i.level === 's4').length;
  const fixable = issues.filter(i => i.fixable).length;
  const pages = new Set(issues.map(i => i.page)).size;
  const incomplete = state.scanCancelled;
  const scanTime = state.scanResult?.duration ? (state.scanResult.duration / 1000).toFixed(1) + 's' : '';
  const scanTs = state.scanResult?.completedAt || '';
  const r010Empty = state.r010EmptyWarning;

  return `
    <div class="heading">
      <div>
        <h1>扫描结果概览</h1>
        <div class="muted">${state.fileName || ''} · ${state.scanMode === 'quick' ? '快速检查' : '标准检查'} · builtin-rules-v1.0${scanTime ? ' · 耗时 ' + scanTime : ''}${scanTs ? ' · ' + scanTs : ''}</div>
      </div>
      <div class="toolbar">
        <button class="btn" onclick="location.hash='scan-settings'">重新扫描</button>
        <button class="btn primary" onclick="location.hash='issue-list'">查看问题</button>
      </div>
    </div>
    ${incomplete ? '<div class="info" style="margin-bottom:18px;color:#9b5b00;border-color:#f2c879;background:#fff9e8"><b>扫描未完成</b>　可查看已发现问题，但自动修复不可用。</div>' : ''}
    ${r010Empty ? '<div class="info" style="margin-bottom:18px;color:#9b5b00;border-color:#f2c879;background:#fff9e8"><b>敏感词库为空</b>　敏感及残留文本检查（R010）已执行，但因词库为空未检测任何词条。未发现问题不代表无敏感内容，请前往<a href="#sensitive-words" style="color:#1f5eff;text-decoration:underline">敏感词库</a>添加词条后重新扫描。</div>' : ''}
    <div class="grid summary">
      ${[['S1 严重', countS1, 's1'], ['S2 高风险', countS2, 's2'], ['S3 一般', countS3, 's3'], ['S4 建议', countS4, 's4'], ['涉及页面', pages, ''], ['可自动修复', fixable, 'ok']]
        .map(x => `<div class="card stat"><span class="badge ${x[2]}">${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}
    </div>
    <div class="card charts" style="margin-top:20px">
      <h2>按问题类型统计</h2>
      ${(() => {
        // 按类型聚合
        const types = {};
        issues.forEach(i => { types[i.type] = (types[i.type] || 0) + 1; });
        const max = Math.max(...Object.values(types), 1);
        return Object.entries(types).map(([k, v]) =>
          `<div class="bar"><label>${k}</label><i style="width:${Math.round(v / max * 100)}%"></i></div>`
        ).join('');
      })()}
    </div>
    ${issues.length === 0 ? '<div class="card" style="padding:40px;text-align:center;margin-top:20px"><h2 style="margin:0">未发现符合当前规则的问题</h2></div>' : ''}
  `;
}
