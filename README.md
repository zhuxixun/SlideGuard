# SlideGuard

离线 PPT 智能质检与规范化工具

对企业级 PowerPoint 文件进行自动化质量检查，涵盖字体规范、版面布局、跨页一致性、图片质量、文本规范性 5 大维度 20+ 条质检规则。所有文件在本地处理，无需网络连接。

## 功能特性

- **一键扫描** — 拖拽 .pptx 文件，自动执行 20+ 条质量规则
- **多维评分** — 从文档完整性、文本规范性、版面布局、跨页一致性、图片质量 5 个维度综合打分
- **精准定位** — 三栏界面，左侧页面列表、中间画布预览（高亮问题元素）、右侧问题详情
- **自动修复** — 支持字体替换、字号调整、颜色校正、元素归位、图片比例修复、空白页删除等 8 种自动修复
- **智能聚类** — 基于 DBSCAN 的页面聚类分析，自动识别异常页面
- **报告导出** — 支持 HTML 和 Excel 两种格式的质量报告
- **完全离线** — 所有分析在本机完成，文件不上传任何服务器

## 质检规则

| 维度 | 规则 | 说明 | 严重度 |
|------|------|------|--------|
| 文档完整性 | 页面尺寸 | 检查页面比例是否为 16:9 | S2 |
| 文档完整性 | 空白页面 | 检测无内容或仅有装饰元素的页面 | S2 |
| 文档完整性 | 页面外元素 | 检测超出页面边界的元素 | S2 |
| 文档完整性 | 极小元素 | 检测可能为残留辅助图形的小元素 | S4 |
| 文档完整性 | 页码 | 检测缺失页码的页面 | S3 |
| 文档完整性 | Logo | 检测页面是否缺少企业 Logo | S3 |
| 文档完整性 | 页脚 | 检测页脚内容一致性 | S3 |
| 文本规范性 | 非标准字体 | 检测未使用企业标准字体的文本 | S3 |
| 文本规范性 | 字体内混用 | 检测同一文本框内混用多种字体 | S4 |
| 文本规范性 | 标题字体一致性 | 同类型页面标题字体保持一致 | S3 |
| 文本规范性 | 正文字号过小 | 正文字号低于最小阈值 | S3 |
| 文本规范性 | 标题字号一致性 | 同类型页面标题字号保持一致 | S3 |
| 文本规范性 | 非标准颜色 | 检测使用非标准色板中的颜色 | S3 |
| 文本规范性 | 颜色数量过多 | 单页颜色数超过建议值 | S4 |
| 文本规范性 | 文本对比度 | 检测与背景对比度不足的文字 | S3 |
| 文本规范性 | 敏感文本 | 检测敏感或残留文本内容 | S1 |
| 版面布局 | 对齐 | 检测元素是否对齐 | S3 |
| 版面布局 | 间距 | 检测元素间距是否一致 | S4 |
| 版面布局 | 重叠 | 检测元素是否相互重叠 | S3 |
| 版面布局 | 边距 | 检测元素是否超出安全边距 | S3 |
| 版面布局 | 文本溢出 | 检测文字超出文本框的问题 | S3 |
| 版面布局 | 密度 | 检测页面内容过密或过疏 | S3/S4 |
| 跨页一致性 | 标题位置 | 同级页面标题位置保持一致 | S3 |
| 图片质量 | 图片拉伸 | 检测宽高比异常（拉伸变形）的图片 | S3 |
| 图片质量 | 图片清晰度 | 检测分辨率不足的图片 | S4 |
| 图片质量 | 图片越界 | 检测超出页面边界的图片 | S3 |

## 快速开始

### 方式一：直接运行（开发模式）

```bash
# 安装依赖
pip install -r requirements.txt

# 启动
export PYTHONPATH=$(pwd):$PYTHONPATH
python3 backend/app.py
```

或使用启动脚本：

```bash
chmod +x run.sh
./run.sh
```

启动后浏览器访问 `http://127.0.0.1:5000`。

### 方式二：打包为独立二进制

```bash
pip install pyinstaller
python build.py
```

运行 `dist/SlideGuard`（Windows 上为 `dist/SlideGuard.exe`）即可。

## 技术栈

- **Python 3.12+** — 核心语言
- **Flask** — Web API 后端
- **python-pptx** — PPTX 文件解析与修复
- **scikit-learn** — 页面聚类分析（DBSCAN）
- **openpyxl** — Excel 报告导出
- **lxml** — XML 解析
- **PyInstaller** — 打包为独立可执行文件

## 项目结构

```
backend/
├── app.py              # Flask API 入口
├── config.py           # 规则配置
├── engine/
│   ├── scanner.py      # 扫描引擎 - 编排所有检查器
│   ├── scorer.py       # 评分引擎 - 5 维度加权评分
│   ├── cluster.py      # 页面聚类分析 (DBSCAN)
│   └── fixer.py        # 自动修复引擎
├── models/
│   └── issue.py        # 数据模型 (Issue, ScanResult, etc.)
├── parsers/
│   └── pptx_parser.py  # PPTX 解析 - 提取文本、字体、颜色、形状、图片
├── reporters/
│   ├── html_reporter.py # HTML 报告生成
│   └── excel_reporter.py # Excel 报告生成
├── rules/
│   ├── base_checker.py  # 检查器基类
│   ├── font_checker.py  # 字体、字号、颜色、敏感文本检查
│   ├── page_checker.py  # 页面尺寸、空白页、越界、隐藏元素检查
│   ├── layout_checker.py # 对齐、间距、重叠、边距、溢出检查
│   ├── consistency.py   # 标题位置、页码、页脚、Logo 一致性检查
│   ├── image_checker.py # 图片拉伸、清晰度、越界检查
│   └── density.py       # 内容密度检查
└── utils/
    ├── color.py         # 颜色工具 (RGB/Hex、对比度、亮度)
    └── geometry.py      # 几何工具 (EMU 转换、重叠计算、对齐检测)

frontend/
├── templates/
│   └── index.html       # SPA 主页面
└── static/
    ├── css/app.css      # 样式
    └── js/
        ├── app.js       # 前端逻辑
        └── api.js       # API 客户端

tests/                  # 28 个测试用例 (pytest)
├── test_parser.py
├── test_color.py
├── test_geometry.py
└── test_fixer.py
```

## 评分机制

5 个维度各占 20% 权重：

| 维度 | 权重 | 覆盖规则 |
|------|------|---------|
| 文档完整性 | 20% | 页面尺寸、空白页、页码、Logo、页脚 |
| 文本规范性 | 20% | 字体、字号、颜色、对比度、敏感词 |
| 版面布局 | 25% | 对齐、间距、重叠、边距、密度 |
| 跨页一致性 | 20% | 标题位置、字体一致性 |
| 图片质量 | 15% | 拉伸变形、清晰度、越界 |

每页从 100 分起扣，按严重度：S1 扣 15 分、S2 扣 8 分、S3 扣 4 分、S4 扣 2 分。

## 开发

```bash
# 安装开发依赖
pip install pytest

# 运行测试
PYTHONPATH=$(pwd) python3 -m pytest tests/ -v

# 运行所有测试
PYTHONPATH=$(pwd) python3 -m pytest tests/
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/scan | 上传并扫描 PPTX 文件 |
| POST | /api/fix | 自动修复问题 |
| POST | /api/rescan | 按文件路径重新扫描 |
| POST | /api/report/html | 生成 HTML 报告 |
| POST | /api/report/xlsx | 生成 Excel 报告 |
| GET | /api/download | 下载修复后的文件 |
| GET | /api/info | 获取应用信息 |
| GET | /api/config | 获取当前配置 |
