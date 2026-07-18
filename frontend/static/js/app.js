/* SlideGuard main application logic */

let currentResult = null;
let currentFile = null;
let currentSlideIndex = null;
let scanAborted = false;

// View switching
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${viewName}`).style.display = 'block';
    document.querySelector(`.nav-btn[data-view="${viewName}"]`)?.classList.add('active');
}

// File handling
function handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
}

function handleFile(file) {
    if (!file.name.endsWith('.pptx')) {
        alert('只支持 .pptx 格式的文件');
        return;
    }
    currentFile = file;
    startScan(file);
}

async function startScan(file) {
    // Show progress
    document.getElementById('upload-area').style.display = 'none';
    const progressEl = document.getElementById('scan-progress');
    progressEl.style.display = 'flex';
    const fill = document.getElementById('progress-fill');
    const status = document.getElementById('scan-status');
    scanAborted = false;

    // Animate progress
    let progress = 0;
    const interval = setInterval(() => {
        if (scanAborted) { clearInterval(interval); return; }
        progress = Math.min(progress + Math.random() * 8, 85);
        fill.style.width = progress + '%';
    }, 500);

    try {
        status.textContent = '正在分析PPT...';
        const result = await apiUpload(file, 'standard');

        clearInterval(interval);
        fill.style.width = '100%';
        status.textContent = '扫描完成！';
        await new Promise(r => setTimeout(r, 400));

        currentResult = result;
        progressEl.style.display = 'none';
        document.getElementById('results-area').style.display = 'block';

        showResults(result);
        enableButtons(result);

    } catch (err) {
        clearInterval(interval);
        progressEl.style.display = 'none';
        document.getElementById('upload-area').style.display = 'flex';
        alert('扫描失败: ' + err.message);
    }
}

function cancelScan() {
    scanAborted = true;
    document.getElementById('scan-progress').style.display = 'none';
    document.getElementById('upload-area').style.display = 'flex';
}

// Results display
function showResults(result) {
    // Score
    const scoreColor = result.score >= 80 ? '#28a745' : result.score >= 60 ? '#ffc107' : '#dc3545';
    const scoreEl = document.getElementById('total-score');
    scoreEl.textContent = result.score;
    scoreEl.style.color = scoreColor;

    document.getElementById('s1-count').textContent = result.s1_count;
    document.getElementById('s2-count').textContent = result.s2_count;
    document.getElementById('s3-count').textContent = result.s3_count;
    document.getElementById('s4-count').textContent = result.s4_count;
    document.getElementById('fixable-count').textContent = result.fixable_count;

    // Dimension scores
    const dims = document.getElementById('dimensions');
    dims.innerHTML = '';
    const dimLabels = {
        'document_integrity': '文档完整性与交付风险',
        'text_standardization': '文本规范性',
        'layout_quality': '版面布局质量',
        'cross_page_consistency': '跨页面一致性',
        'image_chart_quality': '图片与图表质量',
    };
    for (const [key, value] of Object.entries(result.dimension_scores || {})) {
        dims.innerHTML += `
            <div class="dim-item">
                <div class="dim-label">${dimLabels[key] || key}</div>
                <div class="dim-value">${value}</div>
                <div class="dim-bar"><div class="dim-fill" style="width:${value}%"></div></div>
            </div>
        `;
    }

    // Build slide list
    const slideList = document.getElementById('slide-list');
    slideList.innerHTML = '';

    // Sort slides: problem pages first, then by index
    const sortedSlides = [...result.slides].sort((a, b) => {
        const aScore = a.s1_count * 100 + a.s2_count * 10;
        const bScore = b.s1_count * 100 + b.s2_count * 10;
        return bScore - aScore; // most problematic first
    });

    for (const slide of sortedSlides) {
        const item = document.createElement('div');
        item.className = 'slide-item';
        item.dataset.index = slide.slide_index;
        item.onclick = () => showSlide(slide.slide_index);

        const badges = [];
        if (slide.s1_count) badges.push(`<span class="slide-badge S1">${slide.s1_count}</span>`);
        if (slide.s2_count) badges.push(`<span class="slide-badge S2">${slide.s2_count}</span>`);
        if (slide.s3_count) badges.push(`<span class="slide-badge S3">${slide.s3_count}</span>`);
        if (slide.s4_count) badges.push(`<span class="slide-badge S4">${slide.s4_count}</span>`);

        const hasIssues = slide.issue_count > 0;
        item.innerHTML = `
            <span class="slide-num" style="${hasIssues ? 'background:#fff3cd' : ''}">${slide.slide_index + 1}</span>
            <span>${hasIssues ? `第${slide.slide_index + 1}页` : `第${slide.slide_index + 1}页`}</span>
            ${badges.length ? `<span class="slide-badges">${badges.join('')}</span>` : ''}
        `;
        slideList.appendChild(item);
    }

    // Show first problem slide
    const firstProblem = result.slides.find(s => s.issue_count > 0);
    if (firstProblem) {
        showSlide(firstProblem.slide_index);
    } else if (result.slides.length > 0) {
        showSlide(result.slides[0].slide_index);
    }
}

function showSlide(slideIndex) {
    currentSlideIndex = slideIndex;

    // Highlight in list
    document.querySelectorAll('.slide-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.index) === slideIndex);
    });

    const slide = currentResult.slides.find(s => s.slide_index === slideIndex);
    if (!slide) return;

    // Update preview title
    const issueCount = slide.issue_count;
    document.getElementById('preview-title').textContent =
        `第${slideIndex + 1}页 - ${issueCount} 个问题 (评分: ${slide.score})`;

    // Draw simple preview
    drawSlidePreview(slideIndex);

    // Show issues
    const detail = document.getElementById('issue-detail');
    if (slide.issues.length === 0) {
        detail.innerHTML = '<div class="issue-placeholder">本页未发现问题</div>';
        return;
    }

    detail.innerHTML = '';
    for (const issue of slide.issues) {
        const el = document.createElement('div');
        el.className = `issue-item ${issue.severity}`;

        const fixBtn = issue.auto_fixable
            ? `<button class="issue-btn fix" onclick="fixSingle('${issue.rule_id}', ${slideIndex})">修复</button>`
            : '';

        el.innerHTML = `
            <div class="issue-hdr">
                <span class="issue-badge ${issue.severity}">${issue.severity}</span>
                <span class="issue-rule">${issue.rule_name}</span>
            </div>
            <div class="issue-desc">${issue.description}</div>
            <div class="issue-detail-text">${issue.detail}</div>
            <div class="issue-suggestion">建议：${issue.suggestion}</div>
            ${fixBtn ? `<div class="issue-actions">${fixBtn}</div>` : ''}
        `;
        detail.appendChild(el);
    }
}

function drawSlidePreview(slideIndex) {
    const canvas = document.getElementById('slide-canvas');
    const placeholder = document.getElementById('preview-placeholder');
    const ctx = canvas.getContext('2d');

    const container = document.getElementById('preview-canvas');
    const maxW = container.clientWidth - 20;
    const maxH = container.clientHeight - 20;

    // Page dimensions
    const pw = currentResult.page_width;
    const ph = currentResult.page_height;
    const ratio = ph / pw;
    let w = Math.min(maxW, 800);
    let h = w * ratio;

    if (h > maxH) { h = maxH; w = h / ratio; }

    canvas.style.display = 'block';
    placeholder.style.display = 'none';
    canvas.width = w * 2; // retina
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    ctx.scale(2, 2);
    ctx.clearRect(0, 0, w, h);

    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, w, h);

    const scale = w / pw;
    const slide = currentResult.slides.find(s => s.slide_index === slideIndex);
    if (!slide) return;

    // Draw issue elements as highlighted boxes
    for (const issue of slide.issues) {
        const loc = issue.location;
        if (!loc) continue;

        const x = loc.left * scale;
        const y = loc.top * scale;
        const ew = loc.width * scale || 20;
        const eh = loc.height * scale || 10;

        if (x < 0 || x > w || y < 0 || y > h) continue;

        const sevColors = { S1: 'rgba(220,53,69,0.3)', S2: 'rgba(255,193,7,0.3)', S3: 'rgba(23,162,184,0.2)', S4: 'rgba(108,117,125,0.15)' };
        const borderColors = { S1: '#dc3545', S2: '#ffc107', S3: '#17a2b8', S4: '#6c757d' };

        ctx.fillStyle = sevColors[issue.severity] || 'rgba(0,0,0,0.1)';
        ctx.fillRect(x, y, ew, eh);
        ctx.strokeStyle = borderColors[issue.severity] || '#999';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(x, y, ew, eh);
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = '#333';
        ctx.font = '9px sans-serif';
        ctx.fillText(issue.rule_name, x + 2, y + 10);
    }

    // Draw non-issue shapes as light outlines
    const nonIssueShapeIds = new Set(
        (slide.issues || []).map(i => i.location?.element_id)
    );
}

// Filters
function applyFilters() {
    const sevFilter = document.getElementById('filter-severity').value;
    const fixFilter = document.getElementById('filter-fixable').value;

    document.querySelectorAll('.slide-item').forEach(el => {
        const idx = parseInt(el.dataset.index);
        const slide = currentResult?.slides.find(s => s.slide_index === idx);
        if (!slide) { el.style.display = 'flex'; return; }

        let show = true;
        if (sevFilter) {
            const counts = { S1: slide.s1_count, S2: slide.s2_count, S3: slide.s3_count, S4: slide.s4_count };
            show = counts[sevFilter] > 0;
        }
        if (fixFilter === 'fixable' && slide.fixable_count === 0) show = false;
        if (fixFilter === 'not_fixable' && slide.fixable_count === slide.issue_count) show = false;

        el.style.display = show ? 'flex' : 'none';
    });
}

function filterBySeverity(sev) {
    document.getElementById('filter-severity').value = sev;
    applyFilters();
}

// Buttons
function enableButtons(result) {
    document.getElementById('report-btn').disabled = false;
    document.getElementById('fix-btn').disabled = result.fixable_count === 0;
    document.getElementById('download-btn').disabled = false;
}

// Fix
function fixSingle(ruleId, slideIndex) {
    // For single issue fix, we do a full fix and rescan
    confirmFix();
}

async function confirmFix() {
    if (!currentResult?.file_path) return;

    try {
        const result = await apiFix(currentResult.file_path);

        document.getElementById('before-score').textContent = currentResult.score;
        document.getElementById('before-issues').textContent = currentResult.total_issues + ' 个问题';
        document.getElementById('after-score').textContent = result.after_score ?? '--';
        document.getElementById('after-issues').textContent = (result.after_issues ?? '--') + ' 个问题';
        document.getElementById('fix-count').textContent = result.fixed_count;

        // Store fixed file path for later use
        currentResult.file_path = result.output_path;

        // Switch buttons: hide confirm, show rescan and download
        document.getElementById('fix-confirm-btn').style.display = 'none';
        document.getElementById('fix-rescan-btn').style.display = 'inline-block';
        document.getElementById('fix-download-btn').style.display = 'inline-block';

        showView('fix');

    } catch (err) {
        alert('修复失败: ' + err.message);
    }
}

async function downloadFile() {
    if (!currentResult?.file_path) return;
    try {
        const res = await fetch(`/api/download?path=${encodeURIComponent(currentResult.file_path)}`);
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fixed_${currentResult.file_name || 'presentation.pptx'}`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('下载失败: ' + err.message);
    }
}

async function reScan() {
    if (!currentResult?.file_path) return;
    try {
        const result = await apiRescan(currentResult.file_path);
        currentResult = result;
        showResults(result);
        showView('scan');
    } catch (err) {
        alert('重新扫描失败: ' + err.message);
    }
}

// Report download
async function downloadReport() {
    if (!currentResult?.file_path) return;

    try {
        const res = await apiReport(currentResult.file_path, 'html');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SlideGuard_Report_${currentResult.file_name}.html`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('报告导出失败: ' + err.message);
    }
}
