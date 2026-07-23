/**
 * SlideGuard 状态管理
 * 简单的发布订阅 Store
 */
export class Store {
  constructor(initial = {}) {
    this.state = initial;
    this.listeners = [];
  }

  get(key) {
    return key ? this.state[key] : this.state;
  }

  set(key, value) {
    this.state[key] = value;
    this.notify();
  }

  update(patch) {
    Object.assign(this.state, patch);
    this.notify();
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }
}

/** 全局单例 */
export const store = new Store({
  // 文件状态
  fileName: null,
  fileSize: null,
  pageCount: null,
  pptxData: null,       // ArrayBuffer of loaded .pptx

  // 扫描状态
  scanMode: null,        // 'quick' | 'standard' | 'custom'
  scanRules: [],         // 选中的规则列表
  isScanning: false,
  scanProgress: null,    // { current, total, stage, issues }
  scanResult: null,      // 完整扫描结果
  scanComplete: false,
  scanCancelled: false,

  // 问题列表
  issues: [],
  selectedIssues: new Set(),
  currentIssueIndex: -1,

  // 敏感词库
  sensitiveWords: ['机密', '绝密', '内部资料', '不得外传', '未公开'],

  // 修复状态
  fixResult: null,

  // 页面预览数据（扫描后提取）
  slidePreviews: [],    // [{page, texts: [...], shapes: [...], loadError}]
  presInfo: { width: 12192000, height: 6858000 },
  r009EmptyWarning: false,

  // UI 状态
  hasScanResult: false,
});
