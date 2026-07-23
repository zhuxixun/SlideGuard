# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

**⚠️ 重要：每次修改 `src/` 下的代码后，都必须重新编译。** 打开 `dist/index.html` 看到的是打包后的代码，不编译则修改不生效。

**⚠️ 用户说"提交一下"默认包含 commit + push，不需要等用户再说一次"推送"。**

```bash
npm run build      # Bundle with esbuild → dist/app.bundle.js
npm run watch      # Watch mode rebuild (自动监听变化)
```

After building, open `dist/index.html` in Chrome/Edge to run the app. No server, no install — pure browser-side.

## Project Overview

**SlideGuard** — an offline PowerPoint quality & compliance checking tool. It runs entirely in the browser, parsing `.pptx` files via JSZip + fast-xml-parser, scanning for issues (font, layout, text overflow, sensitive words, etc.), and auto-fixing some of them. No backend, no upload, no API keys.

## Architecture

### Hash Router (`src/router.js`)
- Routes map hash to page: `#scan-result` → `renderScanResult` + sidebar active state
- `initRouter()` listens to `hashchange`, renders `shell(sidebar + main content)`
- 8 sidebar entries: `首页 → 扫描设置 → 敏感词库 → 扫描结果 → 问题列表 → 问题详情 → 修复 → 修复结果`
- Empty-state guard: if `hasScanResult` is false, certain routes show a guidance page instead

### State (`src/store.js`)
- Simple pub/sub Store singleton. `store.get(key)` / `store.set(key, value)` / `store.update(patch)`
- Key state: `issues[]`, `selectedIssues Set`, `currentIssueIndex`, `slidePreviews[]`, `presInfo`, `hasScanResult`, `scanCancelled`, `fixResult`

### Pages (`src/pages/`)
Each page exports `render*(state)` and optionally `afterRender*(state)`:

| Route | Page | File | Key behavior |
|-------|------|------|-------------|
| `#home` | 首页 | `home.js` | File import (click/drag), supports `.pptx` only |
| `#scan-settings` | 扫描设置 | `scanSettings.js` | Quick/Standard/Custom mode selection |
| `#sensitive-words` | 敏感词库 | `sensitiveWords.js` | Word list CRUD, local storage |
| `#scanning` | 扫描中 | `scanning.js` | Progress bar + triggers `runScan`, supports cancel |
| `#scan-result` | 扫描结果 | `scanResult.js` | Issue summary by level + type chart |
| `#issue-list` | 问题列表 | `issueList.js` | Filterable table, checkbox selection, ignore |
| `#issue-detail` | 问题详情 | `issueDetail.js` | Slide preview with highlight, prev/next nav |
| `#fix-confirm` | 修复确认 | `fixConfirm.js` | Change list preview, triggers `fixIssues` |
| `#fix-result` | 修复结果 | `fixResult.js` | Fix stats, before/after chart, re-scan link |

### Core Engine (`src/core/`)

**`pptxParser.js`** — Parses OOXML ZIP structure. Extracts slide text, shapes, metadata. Key functions: `parsePptx()`, `loadSlide()`, `extractTexts()`, `extractShapes()`.

**`ruleEngine.js`** — Orchestrates scanning: parse ZIP → load all slides → run page-level rules → run cross-page rules → summarize. Each rule checks one dimension. Progress callbacks drive the scanning page UI.

**`fixEngine.js`** — Modifies slide XML in memory (not the original file). Supports font replacement (R004), font size adjustment (R005), position alignment (R007), title style fix (R009). Outputs new ZIP and triggers browser download.

**`rules/`** — One file per rule (R002–R010). Each exports `{ id, name, level, pageLevel, crossPage }` and `check(slide, presInfo, context)` / `checkCrossPage(slides, presInfo)`.

### Styles (`src/styles/`)
- `main.css` — All core styles (layout, sidebar, cards, tables, buttons, progress, charts, detail view)
- `empty-state.css` — Empty state card styles

### Design Mockups (`design/ui/source/`)
- `mockups.js` — Single-file prototype with all page templates, hash-routed via `data-page`
- `mockups.css` / `responsive.css` — Design system CSS (1600×900 base, responsive down to 1180×700)
- `pages/*.html` — Standalone pages, each links to `mockups.js`

## Key Conventions

- **Issue format**: Each issue is `{ page, type, level: 's1'|'s2'|'s3'|'s4', desc, rule, fixable, actual, expected, source, reason, suggestion, status, object, fixData, sensitiveWord?, charRange? }`
- **Fixable rules only**: R004 (font), R005 (font size), R007 (alignment), R009 (title style). All others are detection-only.
- **Sidebar**: Always visible, all entries shown. Empty states guide the user instead of hiding entries.
- **Privacy**: Zero network requests. All computation in browser sandbox. Sensitive words stored in LocalStorage/IndexedDB.
- **File safety**: Original file is never modified. Fixed files are downloaded via browser's "Save As" dialog with filename pattern `*_SlideGuard_fixed_yyyymmdd_HHmmss.pptx`.
- **设计稿先行**: 所有涉及 UI 界面设计的修改，必须先改 `design/ui/source/` 下的设计稿（`mockups.js`/`mockups.css`），经用户认可后才能修改 `src/` 下的实现代码。

## Common Tasks

- **Add a new rule**: Create `src/core/rules/rNNN.js` with `{ id, name, pageLevel, check() }`, import and register in `ruleEngine.js`, add to scan mode presets in `scanSettings.js`
- **Add a new page**: Create `src/pages/newPage.js`, add route entry in `router.js` + sidebar entry in `sidebar.js`, update design mockup in `design/ui/source/mockups.js`
- **Update design**: Edit `mockups.js` (page templates) and `mockups.css` (styles), then mirror changes to `src/pages/*.js` and `src/styles/main.css`
