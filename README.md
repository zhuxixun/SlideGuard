# SlideGuard
### 离线 PowerPoint 质量与合规检查工具

**SlideGuard** 是一款完全运行于浏览器本地的 PowerPoint（.pptx）质量检测与自动修复工具。无需安装任何后端服务，无需联网，无需上传文件到服务器——所有解析、检测和修复均在浏览器的沙箱内完成，保障文档隐私安全。

> 只需解压，双击 `index.html`，即可开始使用。

---

## 功能概览

| 功能 | 说明 |
|------|------|
| **文件导入** | 支持点击或拖拽导入 `.pptx` 文件，显示文件名称、大小和页数 |
| **快速检查** | 组合执行核心规则（字体、空白页、页面外元素、标题一致性、敏感词），适合快速预览 |
| **标准检查** | 执行全部基础检测规则，覆盖文档健康、文本规范、版面布局和跨页一致性 |
| **自定义检查** | 自由勾选需要执行的规则，灵活组合扫描范围 |
| **问题列表** | 按页面、类型、级别、可修复性、状态等多维度筛选，支持搜索 |
| **问题详情** | 页面预览 + 高亮定位 + 规则依据 + 实际值与标准值对比 + 导航 |
| **自动修复** | 支持字体替换、元素对齐、标题样式修复，修复后重新扫描并输出对比 |
| **敏感词库** | 内置独立管理页面，支持搜索、新增、编辑、删除和批量粘贴词条 |
| **零隐私风险** | 全程离线运行，不发起任何网络请求，文件只存在于浏览器内存中 |

---

## 检测规则

| 规则 | 描述 | 级别 | 可修复 |
|------|------|------|--------|
| R002 | 空白页面检查 | S3 | ❌ |
| R003 | 页面外元素检查 | S2/S3 | ❌ |
| R004 | 字体一致性检查（标准字体：微软雅黑） | S1 | ✅ |
| R006 | 元素对齐检查 | S3 | ✅ |
| R007 | 文字安全边距检查 | S3 | ❌ |
| R008 | 标题一致性检查（字体、加粗、颜色） | S1 | ✅ |
| R009 | 敏感及残留文本检查 | S1 | ❌ |

**严重级别：** S1（严重）> S2（高风险）> S3（一般）> S4（建议）

---

## 快速开始

### 使用预构建版本

1. 从发布页下载 `SlideGuard-v*.zip`
2. 解压到任意目录
3. 双击 `index.html`，在 Chrome / Edge 中打开
4. 点击首页"打开PPT文件"或拖入 `.pptx` 文件
5. 选择扫描模式（快速 / 标准 / 自定义），开始扫描

### 从源码构建

```bash
# 安装依赖
npm install

# 开发构建
npm run build

# 监听模式（自动重新编译）
npm run watch
```

构建后打开 `dist/index.html` 即可运行。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 语言 | JavaScript (ES Module) |
| 打包 | [esbuild](https://esbuild.github.io/) |
| PPTX 解析 | [JSZip](https://stuk.github.io/jszip/) + [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) |
| 路由 | 原生 Hash Router |
| 状态管理 | 发布/订阅模式 Store |
| 存储 | IndexedDB / LocalStorage |
| 运行环境 | Chrome 100+ / Edge 100+ |

---

## 项目结构

```
slideguard/
├── index.html              # 入口 HTML
├── build.mjs               # esbuild 构建脚本
├── package.json
├── PRD.md                  # 产品需求文档
├── src/
│   ├── app.js              # 应用入口
│   ├── router.js           # Hash 路由
│   ├── store.js            # 全局状态管理
│   ├── components/
│   │   └── sidebar.js      # 侧边栏组件
│   ├── core/
│   │   ├── pptxParser.js   # PPTX 解析器
│   │   ├── ruleEngine.js   # 规则引擎（扫描调度）
│   │   ├── fixEngine.js    # 修复引擎
│   │   └── rules/
│   │       ├── r002.js     # 空白页面
│   │       ├── r003.js     # 页面外元素
│   │       ├── r004.js     # 字体一致性
│   │       ├── r006.js     # 元素对齐
│   │       ├── r007.js     # 文字安全边距
│   │       ├── r008.js     # 标题一致性
│   │       └── r009.js     # 敏感及残留文本
│   ├── pages/
│   │   ├── home.js         # 首页
│   │   ├── scanSettings.js # 扫描设置
│   │   ├── scanning.js     # 扫描中
│   │   ├── scanResult.js   # 扫描结果
│   │   ├── issueList.js    # 问题列表
│   │   ├── issueDetail.js  # 问题详情
│   │   ├── fixConfirm.js   # 修复确认
│   │   ├── fixResult.js    # 修复结果
│   │   └── sensitiveWords.js# 敏感词库
│   ├── utils/
│   │   ├── download.js     # 文件下载
│   │   └── preview.js      # 页面预览
│   └── styles/
│       ├── main.css        # 核心样式
│       └── empty-state.css # 空状态样式
└── design/
    └── ui/source/          # 设计稿（mockups）
```

---

## 设计理念

- **零信任隐私：** 绝不发起任何网络请求，不依赖任何后端服务
- **离线优先：** 所有计算在浏览器沙箱内完成，断网与联网体验一致
- **可解释性：** 每个问题都展示触发原因、判断依据和修改建议
- **安全修复：** 永不修改原始文件，修复结果始终保存为新文件

---

## 浏览器兼容

- Chrome 100+
- Edge 100+
- 以 Chrome 为主要验收浏览器

---

## 许可

本项目为内部项目，保留所有权利。
