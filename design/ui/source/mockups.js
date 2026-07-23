const responsiveStyle=document.createElement('link');responsiveStyle.rel='stylesheet';responsiveStyle.href=new URL('responsive.css',document.currentScript.src);document.head.appendChild(responsiveStyle);
const nav=(active)=>`<aside class="side"><div class="logo"><span>◆</span> SlideGuard</div><div class="nav">${['首页','扫描设置','敏感词库','扫描结果','问题列表','问题详情','修复','修复结果'].map(x=>`<div class="${x===active?'active':''}">${x}</div>`).join('')}</div><div class="privacy"><b>● 离线运行</b>文件仅在本机处理，<br>不会上传或访问互联网</div></aside>`;
const shell=(active,content)=>`<div class="app"><div class="body">${nav(active)}<main class="main">${content}</main></div></div>`;
const heading=(title,sub,actions='')=>`<div class="heading"><div><h1>${title}</h1><div class="muted">${sub}</div></div><div class="toolbar">${actions}</div></div>`;

/* ── 扫描设置模式切换 ── */
window.switchMode=function(m){['quick','standard','custom'].forEach(k=>{document.getElementById('panel-'+k).style.display=k===m?'block':'none';document.getElementById('mode-'+k).className='card mode'+(k===m?' selected':'');});var btn=document.querySelector('.scan-start');if(btn){var labels={'quick':'开始快速检查','standard':'开始标准检查','custom':'开始自定义检查'};btn.textContent=labels[m]||'开始扫描';}}

/* ── 页面路由（键名对应 HTML data-page）── */
const pages={
/* 01 ── 首页（空状态） */
'1':()=>shell('首页',`${heading('欢迎使用 SlideGuard','离线 PowerPoint 质量与合规检查工具','<span class="badge ok">● 离线运行</span>')}<div class="drop"><div><div class="ppt">P</div><h2>将 .pptx 文件拖到此处</h2><button class="btn primary">打开PPT文件</button><p class="muted">支持单个 .pptx 文件</p></div></div><div class="card file-error"><b>不支持的文件类型：年度经营汇报.pptm</b><br><span class="muted">发生了什么：选择了 .pptm 文件。原因：该格式可能包含宏代码。下一步：请另存为 .pptx 后重新导入。</span></div>`),

/* 01A ── 首页（文件已加载） */
'1a':()=>shell('首页',`${heading('欢迎使用 SlideGuard','离线 PowerPoint 质量与合规检查工具','<span class="badge ok">● 离线运行</span>')}<div class="file-loaded"><div class="file-loaded-main"><div class="ppt-loaded">P</div><div class="file-loaded-info"><div class="file-loaded-name">年度经营汇报.pptx</div><div class="file-loaded-meta">18.6 MB　|　42 页</div><div class="file-loaded-path">D:\\报告\\年度经营汇报.pptx</div><div class="file-loaded-status">● 文件解析成功，可以开始检查</div></div></div><div class="file-loaded-actions"><button class="btn primary" onclick="location.hash=\'2\'">开始扫描</button></div></div><div class="replace-bar"><span class="muted">拖拽新文件替换　或　</span><button class="btn" style="height:34px;padding:0 14px;font-size:13px" onclick="location.hash=\'1\'">重新选择</button></div>`),

/* 02 ── 扫描设置 */
'2':()=>{
  const modeCard=(k,icon,title,desc,sel)=>`<div class="card mode${sel?' selected':''}" id="mode-${k}" onclick="switchMode('${k}')"><div class="icon">${icon}</div><h2>${title}</h2><p class="muted">${desc}</p></div>`;
  const quickItems=[
    {n:'空白页面检查',d:'检测疑似空白页面'},
    {n:'页面外元素检查',d:'检测画布外残留元素'},
    {n:'字体一致性检查',d:'检查非标准字体 · 可自动修复'},
    {n:'文本溢出检查',d:'检查文字被截断或超出画布'},
    {n:'标题一致性检查',d:'检查标题样式与位置 · 可自动修复'},
    {n:'敏感及残留文本检查',d:'检测敏感词库中的词条'}];
  const standardGroups=[
    {g:'文档基础健康',items:[{n:'空白页面检查',d:'检测疑似空白页面'},{n:'页面外元素检查',d:'检测画布外残留元素'}]},
    {g:'文本规范',items:[{n:'字体一致性检查',d:'非标准字体 · 可自动修复'},{n:'字号一致性检查',d:'字号过小及不一致 · 可自动修复'},{n:'文本溢出检查',d:'文字被截断或超出画布'},{n:'敏感及残留文本检查',d:'检测敏感词库词条'}]},
    {g:'版面布局',items:[{n:'元素对齐检查',d:'对齐偏差 · 可自动修复'},{n:'文字安全边距检查',d:'文字距边缘过近'}]},
    {g:'跨页一致性',items:[{n:'标题一致性检查',d:'标题样式与位置 · 可自动修复'}]}];
  const customItems=[
    {n:'空白页面检查',d:'检测疑似空白页面',f:!1},
    {n:'页面外元素检查',d:'检测画布外残留元素',f:!1},
    {n:'字体一致性检查',d:'非标准字体 · 可自动修复',f:!0},
    {n:'字号一致性检查',d:'字号过小及不一致 · 可自动修复',f:!0},
    {n:'文本溢出检查',d:'文字被截断或超出画布',f:!1},
    {n:'元素对齐检查',d:'对齐偏差 · 可自动修复',f:!0},
    {n:'文字安全边距检查',d:'文字距页面边缘过近',f:!1},
    {n:'标题一致性检查',d:'标题样式与位置 · 可自动修复',f:!0},
    {n:'敏感及残留文本检查',d:'检测敏感词库中的词条',f:!1}];
  const qHTML=`<div id="panel-quick" class="rules-panel" style="display:block"><div class="card rules" style="grid-template-columns:1fr"><div class="rule-header" style="font-weight:700;color:#172033;padding-bottom:8px;border-bottom:1px solid var(--line)">快速检查将执行以下 6 项核心规则（固定，不可调整）</div>${quickItems.map(x=>`<div class="rule">${x.n}<span class="muted" style="margin-left:12px">${x.d}</span></div>`).join('')}<div class="rule" style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px;color:var(--muted)">不执行：字号一致性、元素对齐、文字安全边距</div><div class="rule" style="color:var(--muted)">规则版本：builtin-rules-v1.0（只读）</div></div></div>`;
  const sHTML=`<div id="panel-standard" class="rules-panel" style="display:none"><div class="card rules" style="grid-template-columns:1fr;padding:0">${standardGroups.map(g=>`<div style="padding:16px 22px${standardGroups.indexOf(g)?' 8px':''};border-bottom:1px solid var(--line)"><div style="font-weight:700;color:#455168;margin-bottom:6px">${g.g}</div>${g.items.map(x=>`<div class="rule" style="margin:2px 0">${x.n}<span class="muted" style="margin-left:12px">${x.d}</span></div>`).join('')}</div>`).join('')}<div style="padding:12px 22px;color:var(--muted);font-size:13px">规则版本：builtin-rules-v1.0（只读）</div></div></div>`;
  const cHTML=`<div id="panel-custom" class="rules-panel" style="display:none"><div class="card rules" style="grid-template-columns:1fr;padding:0"><div style="padding:14px 22px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px"><span style="font-weight:700">自定义选择检查项</span><span class="muted">已选 9/9</span><div style="margin-left:auto;display:flex;gap:8px"><button class="btn" style="height:32px;padding:0 14px;font-size:13px" onclick="document.querySelectorAll('.custom-ck').forEach(e=>e.checked=true)">全选</button><button class="btn" style="height:32px;padding:0 14px;font-size:13px" onclick="document.querySelectorAll('.custom-ck').forEach(e=>e.checked=false)">全不选</button><button class="btn" style="height:32px;padding:0 14px;font-size:13px">恢复默认</button></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;padding:10px 22px">${customItems.map(x=>`<div style="padding:9px 0;border-bottom:1px solid #f0f2f6"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" class="custom-ck" checked><b style="font-size:14px">${x.n}</b></label><div style="margin:2px 0 0 28px;font-size:13px;color:var(--muted)">${x.d}${x.f?'':'<span style="color:var(--muted)"> · 不支持自动修复</span>'}</div></div>`).join('')}</div><div style="padding:12px 22px;border-top:1px solid var(--line);color:var(--muted);font-size:13px">规则版本：builtin-rules-v1.0（只读）<span style="margin-left:24px">ⓘ 部分自定义扫描禁止自动修复，仅完整标准检查结果可修复</span></div></div></div>`;
  return shell('扫描设置',`${heading('扫描设置','选择扫描模式与本次执行规则','<button class="btn primary scan-start">开始快速检查</button>')}<div class="card path"><b>年度经营汇报.pptx</b><span class="muted">　18.6 MB　|　42 页　|　查看文件详情</span></div><div class="grid mode-grid" style="margin-top:20px">${modeCard('quick','ϟ','快速检查','执行核心高风险规则，速度更快',!0)}${modeCard('standard','◇','标准检查','执行全部基础规则，完成全部基础检查')}${modeCard('custom','☷','自定义检查','按模块选择本次规则')}</div>${qHTML+sHTML+cHTML}`);
},

/* 03 ── 敏感词库 */
'3':()=>shell('敏感词库',`${heading('敏感词库','管理本机敏感词条','<button class="btn">取消</button><button class="btn primary">保存</button>')}<div class="info">ⓘ 本词库仅保存在本机，不会上传或访问互联网。</div><div class="toolbar" style="margin:20px 0"><div class="input" style="width:420px">搜索词条　⌕</div><button class="btn primary">新增词条</button><button class="btn">批量粘贴</button><span class="muted">共 128 条</span></div><div class="card"><table class="table"><thead><tr><th>词条</th><th>最后修改</th><th>操作</th></tr></thead><tbody>${['机密','绝密','内部资料','不得外传','未公开','旧项目名称','内部代号','过期版本'].map((x,i)=>`<tr><td><b>${x}</b></td><td>2026-07-${20-i}</td><td style="color:#1f5eff">编辑　<span style="color:#e5484d">删除</span></td></tr>`).join('')}</tbody></table></div>`),

/* 04 ── 扫描中 */
'4':()=>shell('扫描结果',`${heading('正在扫描','年度经营汇报.pptx','<button class="btn danger">取消扫描</button>')}<div class="progress-steps">${['解析文件','生成页面预览','执行检查','汇总结果'].map((x,i)=>`<div class="step ${i<2?'done':i===2?'current':''}"><b>${i<2?'✓':i+1}</b>${x}</div>`).join('')}</div><b>正在处理第 18/42 页</b><div class="progress" style="margin:14px 0"><span></span></div><div class="grid scan-cols"><div class="card checklist">${['敏感词检测','字体一致性检查','字号一致性检查','文本溢出检查','元素对齐检查','文字安全边距检查','标题一致性检查'].map(x=>`<div class="check">${x}<span class="muted" style="margin-left:auto">已完成</span></div>`).join('')}</div><div class="grid" style="grid-template-columns:1fr 1fr">${[['S1 严重','3','s1'],['S2 高风险','5','s2'],['S3 一般','18','s3'],['S4 建议','2','s4']].map(x=>`<div class="card stat"><span class="badge ${x[2]}">${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}</div></div>`),

/* 04B ── 扫描结果概览 */
'4b':()=>shell('扫描结果',`${heading('扫描结果概览','年度经营汇报.pptx · 标准检查 · builtin-rules-v1.0','<button class="btn" onclick="location.hash=\'2\'">重新扫描</button><button class="btn primary" onclick="location.hash=\'5\'">查看问题</button>')}<div class="grid summary">${[['S1 严重','3','s1'],['S2 高风险','5','s2'],['S3 一般','18','s3'],['S4 建议','2','s4'],['涉及页面','16',''],['可自动修复','11','ok']].map(x=>`<div class="card stat"><span class="badge ${x[2]}">${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}</div><div class="card charts" style="margin-top:20px"><h2>按问题类型统计</h2>${[['敏感词',92],['字体规范',78],['文本溢出',61],['字号规范',52],['元素对齐',38]].map(x=>`<div class="bar"><label>${x[0]}</label><i style="width:${x[1]}%"></i></div>`).join('')}</div><div class="info" style="margin-top:18px;color:#9b5b00;border-color:#f2c879;background:#fff9e8"><b>扫描未完成</b>　可查看已发现问题，但自动修复不可用。</div>`),

/* 05 ── 问题列表（独立侧边栏页面） */
'5':()=>shell('问题列表',`${heading('问题列表','共 28 个问题','<button class="btn" onclick="location.hash=\'4b\'">返回概览</button>')}<div class="grid filters"><div class="input">搜索问题描述　⌕</div>${['页面','问题类型','严重级别','可自动修复','处理状态'].map(x=>`<div class="input">${x}　⌄</div>`).join('')}</div><div class="card"><table class="table"><thead><tr><th>选择</th><th>页面</th><th>问题类型</th><th>严重级别</th><th>问题描述</th><th>可自动修复</th><th>处理状态</th></tr></thead><tbody>${[['3','敏感词','s1','检测到敏感词：内部代号','否'],['5','字体规范','s1','标题字体不是微软雅黑','是'],['9','标题一致性','s1','标题颜色与标准值不一致','是'],['8','文本溢出','s2','文本超出页面边界','否'],['12','字号规范','s3','正文小于 14pt','是'],['14','元素对齐','s3','对象偏离参考线 6pt','是'],['16','空白页面','s3','检测到疑似空白页','否'],['18','安全边距','s4','文字距离页面边缘过近','否']].map((x,i)=>`<tr class="clickable" onclick="location.hash='6'"><td><input type="checkbox" ${i<3?'checked':''} onclick="event.stopPropagation()"></td><td>${x[0]}</td><td>${x[1]}</td><td><span class="badge ${x[2]}">${x[2].toUpperCase()}</span></td><td>${x[3]}</td><td>${x[4]}</td><td>待处理</td></tr>`).join('')}</tbody></table></div><div class="selectedbar">已选择 3 项　<button class="btn">忽略</button><button class="btn primary" onclick="location.hash='7'">修复选中项</button></div>`),

/* 04A ── 扫描结果空状态 */
'4a':()=>shell('扫描结果',`${heading('扫描结果概览','查看文件检查结果')}<div class="card empty-state"><div><div class="empty-icon">◇</div><h2>暂无可用的扫描结果</h2><p>请先完成一次标准检查，之后才能查看扫描结果。</p><button class="btn primary" style="margin-top:24px">前往扫描设置</button></div></div>`),

/* 06 ── 问题详情 */
'6':()=>shell('问题详情',`${heading('问题详情与定位','页面 8 / 42','<button class="btn">上一个</button><button class="btn">下一个</button>')}<div class="detail"><div class="card slides"><div class="thumbs">${[6,7,8,9,10].map(x=>`<div class="thumb ${x===8?'active':''}"></div><small>第 ${x} 页</small>`).join('')}</div><div class="preview"><div class="slide"><h2>2026 年度经营目标</h2><div class="guide"></div><div class="issuebox">聚焦核心业务，持续创新，稳健增长</div></div><div class="muted" style="margin-top:14px">缩放 72%　　－　＋　　　　　　　　　　　　　适应窗口</div></div></div><div class="card panel"><h2>⚠ 标题位置与版式不一致</h2><span class="badge s3">S3 一般</span>${[['实际值','标题文本框 Y 坐标为 1.12 cm'],['标准值','标题左侧应与参考线对齐，允许偏差 3pt'],['标准来源','位置标准：当前PPT版式的标题参考线'],['判断依据','标题偏离参考线 0.32 cm'],['修改建议','将标题文本框向上移动 0.32 cm'],['可自动修复','是']].map(x=>`<div class="field"><b>${x[0]}</b>${x[1]}</div>`).join('')}<div class="input" style="margin-top:14px">技术信息（对象 ID、坐标）　⌄</div><div class="footer"><button class="btn">忽略</button><button class="btn primary">修复此问题</button></div></div></div>`),

/* 06A ── 问题详情空状态 */
'6a':()=>shell('问题详情',`${heading('问题详情与定位','查看问题详细信息')}<div class="card empty-state"><div><div class="empty-icon">◇</div><h2>暂无可用的扫描结果</h2><p>请先完成一次标准检查，之后才能查看问题详情。</p><button class="btn primary" style="margin-top:24px">前往扫描设置</button></div></div>`),

/* 07 ── 修复确认 */
'7':()=>shell('修复',`${heading('修复确认','确认修改内容与输出文件','<button class="btn">返回</button><button class="btn primary">确认修复</button>')}<div class="grid fix-grid">${[['已选择','11 个问题'],['涉及','7 页'],['预计修改','8 个对象']].map(x=>`<div class="card stat">${x[0]}<strong>${x[1]}</strong></div>`).join('')}</div><div class="info">ⓘ 原始文件始终保留，修复结果将保存为新文件</div><div class="card" style="margin-top:18px"><table class="table"><thead><tr><th>执行</th><th>页面</th><th>对象</th><th>修改类型</th><th>原值</th><th>目标值</th></tr></thead><tbody>${[['5','标题文本框 1','字体替换','Arial','微软雅黑'],['8','标题文本框 2','位置调整','Y: 1.12 cm','版式标题参考线'],['9','标题文本框 1','标题颜色','RGB(31,78,121)','RGB(192,0,0)'],['10','正文文本框 3','字号统一','11 pt','14 pt'],['12','形状组合 2','元素对齐','偏离参考线 6pt','与左侧参考线对齐']].map(x=>`<tr><td>☑</td>${x.map(y=>`<td>${y}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="card path"><b>输出路径</b><div class="input" style="margin-top:10px">D:\SlideGuard\Output\年度经营汇报_SlideGuard_fixed_20260722_153020.pptx</div><p class="muted">将生成新文件，不会覆盖原文件或已有文件。</p></div>`),

/* 07A ── 修复空状态 */
'7a':()=>shell('修复',`${heading('修复','自动修复可处理字体、字号、标题样式和元素位置')}<div class="card empty-state"><div><div class="empty-icon">◇</div><h2>暂无可用的扫描结果</h2><p>请先完成一次标准检查，之后才能使用修复功能。</p><button class="btn primary" style="margin-top:24px">前往扫描设置</button></div></div>`),

/* 08 ── 修复结果 */
'8':()=>shell('修复结果',`${divSuccess()}<div class="grid fix-result-grid">${[['已修复','11','ok'],['未修复','2','s3']].map(x=>`<div class="card stat"><span class="badge ${x[2]}">${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}</div><div class="grid compare"><div class="card charts"><h2>问题数量对比</h2><div style="display:flex;align-items:flex-end;justify-content:center;gap:100px;height:190px"><div style="width:110px;height:170px;background:#ef7b24;color:#fff;text-align:center;padding-top:15px">修复前 15</div><div style="width:110px;height:55px;background:#13a66a;color:#fff;text-align:center;padding-top:15px">修复后 3</div></div></div><div class="card checklist"><h2>验证结果</h2>${['PPTX 结构完整','页面数量一致','标准检查已完成'].map(x=>`<div class="check">${x}<span style="margin-left:auto;color:#13a66a">通过</span></div>`).join('')}</div></div><div class="footer"><button class="btn" onclick="location.hash='5'">查看剩余问题</button><button class="btn primary" onclick="location.hash='1'">返回首页</button></div>`),

/* 08A ── 修复结果空状态 */
'8a':()=>shell('修复结果',`${heading('修复结果','查看最近一次自动修复的处理结果')}<div class="card empty-state"><div><div class="empty-icon">◇</div><h2>暂无可用的扫描结果</h2><p>请先完成一次标准检查，之后才能使用修复功能。</p><button class="btn primary" style="margin-top:24px">前往扫描设置</button></div></div>`)
};

function divSuccess(){return `<div class="success"><div class="tick">●✓</div><h1>修复完成</h1><p class="muted">文件已保存为新文件，原始文件保持不变</p><div class="input" style="width:850px;margin:auto">D:\SlideGuard\Output\年度经营汇报_SlideGuard_fixed_20260722_153020.pptx</div></div>`}
const id=document.body.dataset.page||location.hash.slice(1)||'1';document.getElementById('app').innerHTML=(pages[id]||pages['1'])();
