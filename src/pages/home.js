/**
 * 首页 — 文件导入
 *
 * 两种状态：
 *   empty  — 拖拽区（无文件）
 *   loaded — 文件已解析，显示文件信息 + 开始扫描
 */
import { store } from '../store.js';
import { readFileAsArrayBuffer, formatFileSize } from '../utils/download.js';
import { parsePptx } from '../core/pptxParser.js';

export function renderHome(state) {
  const hasFile = state.pptxData && state.fileName;
  return `
    <div class="heading">
      <div>
        <h1>欢迎使用 SlideGuard</h1>
        <div class="muted">离线 PowerPoint 质量与合规检查工具</div>
      </div>
      <div class="toolbar">
        <span class="badge ok">● 离线运行</span>
      </div>
    </div>
    <div id="homeContent">
      ${hasFile ? renderHomeLoaded(state) : renderHomeEmpty(state)}
    </div>
  `;
}

function renderHomeEmpty(state) {
  return `
    <div class="drop" id="dropZone">
      <div>
        <div class="ppt">P</div>
        <h2>将 .pptx 文件拖到此处</h2>
        <button class="btn primary" id="openFileBtn">打开PPT文件</button>
        <input type="file" id="fileInput" accept=".pptx" style="display:none">
        <p class="muted">支持单个 .pptx 文件</p>
      </div>
    </div>
    ${state.fileError ? `
    <div class="card file-error">
      <b>${state.fileError.title}</b><br>
      <span class="muted">${state.fileError.detail}</span>
    </div>` : ''}
  `;
}

function renderHomeLoaded(state) {
  return `
    <div class="file-loaded">
      <div class="file-loaded-main">
        <div class="ppt-loaded">P</div>
        <div class="file-loaded-info">
          <div class="file-loaded-name">${state.fileName}</div>
          <div class="file-loaded-meta">${formatFileSize(state.fileSize)}　|　${state.pageCount || '-'} 页</div>
          <div class="file-loaded-path" title="${state.filePath || ''}">${state.filePath || ''}</div>
          <div class="file-loaded-status">● 文件解析成功，可以开始检查</div>
        </div>
      </div>
      <div class="file-loaded-actions">
        <button class="btn primary" onclick="location.hash='scan-settings'">开始扫描</button>
      </div>
    </div>
    <div class="replace-bar">
      <span class="muted">拖拽新文件替换</span>
      <span class="muted">或</span>
      <button class="btn" style="height:34px;padding:0 16px;font-size:13px" onclick="clearFile()">重新选择</button>
    </div>
  `;
}

/* ── 文件清理 ── */
window.clearFile = function() {
  store.update({
    pptxData: null, fileName: null, fileSize: null,
    pageCount: null, filePath: null, fileError: null,
    scanMode: null, scanRules: [], isScanning: false,
    scanProgress: null, scanResult: null, scanComplete: false,
    scanCancelled: false, issues: [], selectedIssues: new Set(),
    currentIssueIndex: -1, hasScanResult: false,
    slidePreviews: [], presInfo: { width: 12192000, height: 6858000 },
    r009EmptyWarning: false,
  });
  rerenderHome();
};

function rerenderHome() {
  const container = document.getElementById('homeContent');
  if (!container) return;
  const state = store.get();
  const hasFile = state.pptxData && state.fileName;
  container.innerHTML = hasFile ? renderHomeLoaded(state) : renderHomeEmpty(state);
  if (!hasFile) attachDropHandlers();
}

/* ── 文件处理 ── */
async function handleFile(file) {
  // 重置错误
  store.set('fileError', null);

  // 验证文件类型
  if (!file.name.toLowerCase().endsWith('.pptx')) {
    store.set('fileError', {
      title: '不支持的文件类型：' + file.name,
      detail: '发生了什么：选择了 ' + (file.name.match(/\.\w+$/)?.[0] || '未知格式') + ' 文件。原因：仅支持 .pptx 格式。下一步：请将文件另存为 .pptx 后重新导入。'
    });
    rerenderHome();
    return;
  }

  try {
    const buffer = await readFileAsArrayBuffer(file);

    // 用 JSZip 解析基本元数据
    const info = await parsePptx(buffer);

    store.update({
      pptxData: buffer,
      fileName: file.name,
      fileSize: file.size,
      pageCount: info.slideCount,
      filePath: file.name,       // 浏览器环境下无法获取完整路径
    });

    rerenderHome();
  } catch (e) {
    console.error('[FileHandler]', e);
    store.set('fileError', {
      title: '文件解析失败：' + file.name,
      detail: '发生了什么：文件无法被正确解析。原因：' + (e.message || '未知错误') + '。下一步：请确认文件是有效的 .pptx 格式且未损坏。'
    });
    rerenderHome();
  }
}

/* ── 拖拽/打开事件绑定 ── */
export function afterRenderHome() {
  attachDropHandlers();
}

function attachDropHandlers() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const openBtn = document.getElementById('openFileBtn');

  if (dropZone) {
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) handleFile(files[0]);
    });
  }

  if (openBtn && fileInput) {
    openBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
        fileInput.value = '';
      }
    });
  }

  // 替换区的拖拽
  const replaceBar = document.querySelector('.replace-bar');
  if (replaceBar) {
    replaceBar.addEventListener('dragover', e => e.preventDefault());
    replaceBar.addEventListener('drop', e => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) handleFile(files[0]);
    });
  }
}
