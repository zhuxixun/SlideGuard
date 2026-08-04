# Repository Guidelines

## Project Structure & Module Organization

SlideGuard is an offline, browser-only PowerPoint quality checker written as JavaScript ES modules. Application code lives in `src/`: `core/` contains PPTX parsing, scan orchestration, repair logic, and numbered rules (`rules/r008.js`); `pages/` contains routed screens; `components/`, `utils/`, and `styles/` contain shared UI code. Tests are in `test/` and mirror behavior rather than directory structure. UI mockups and design references live in `design/ui/source/`; demo assets are under `demo/`. `dist/` is generated output—edit `src/`, then rebuild instead of editing bundled files.

## Build, Test, and Development Commands

- `npm install` installs JSZip, fast-xml-parser, esbuild, and locked dependencies.
- `npm run build` bundles `src/app.js`, copies static assets, and writes `dist/`.
- `npm run watch` rebuilds while source files change; open `dist/index.html` in Chrome or Edge.
- `npm test` runs all Node test files through the built-in `node:test` runner.

Run both `npm test` and `npm run build` before submitting changes.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, single quotes, and modern ES module syntax. Follow existing camelCase naming for variables/functions, PascalCase only for classes, and lowercase filenames. Rule modules use zero-padded IDs such as `r004.js` and export their metadata plus `check`. Keep parser behavior separate from policy decisions in rule files. Comments may be Chinese or English, but should explain OOXML edge cases or intent rather than restate code. No formatter or linter is configured, so match nearby code and review `git diff --check`.

## Testing Guidelines

Use `node:test` with `node:assert/strict`. Name files `*.test.js` and describe observable behavior, for example `test('resolves system theme colors...', ...)`. Add regression tests for parsing, inheritance, mixed text runs, and repair/rescan behavior. Build small PPTX fixtures in memory with JSZip when practical; never rely on network services or mutate the original presentation.

## Commit & Pull Request Guidelines

History favors short, imperative subjects, often Conventional Commit style (`fix: preserve title spaces during auto-fix`). Use `fix:`, `feat:`, `test:`, or `docs:` when appropriate and keep each commit focused. Pull requests should explain the user-visible problem, implementation approach, and verification commands; link the relevant issue. Include screenshots for UI changes and a representative PPTX scenario for parser or repair changes, while removing confidential presentation content.

**⚠️ 用户说“提交一下”默认包含 commit + push，不需要等用户再说一次“推送”。**

## Privacy & Safety

Preserve the offline-only architecture: presentation data must remain in browser memory and must not be uploaded. Repairs must produce a new file rather than overwrite the user’s original.
