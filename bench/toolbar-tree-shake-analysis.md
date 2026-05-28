# Vditor Toolbar Tree-Shake Analysis

Investigation of whether we can shrink `media/dist/main.js` (~408 KB minified) by stripping Vditor toolbar buttons we never render.

Date: 2026-05-27. All paths absolute.

---

## Q1 — Unused toolbar items

### Items our config uses

From `/Users/kish.sachdeva/Documents/repos/vscode-markdown-editor/media-src/src/toolbar.ts`:

Top-level (lines 21–62): `emoji`, `headings`, `bold`, `italic`, `strike`, `link`, `|`, `list`, `ordered-list`, `check`, `outdent`, `indent`, `quote`, `line`, `code`, `inline-code`, `insert-before`, `insert-after`, `upload`, `table`, `undo`, `redo`.

`more.toolbar` submenu (lines 67–136): `both`, `code-theme`, `content-theme`, `preview`, `devtools`, `info`, `help`.

Plus the `name: 'more'` parent (line 65) and `name: 'edit-mode'` (line 63). Custom buttons (`save`, `find`, `outline` w/ no click, `copy-markdown`, `copy-html`, `reset-config`) all route through Vditor's `Custom` class via the `default:` branch in the `genItem` switch.

Note: although `outline` is in our toolbar.ts (line 57) it has no `click`, so Vditor's `case "outline"` branch DOES match and instantiates `Outline`. So `Outline` IS used.

### Vditor's full built-in switch (file: `/Users/kish.sachdeva/Documents/repos/vscode-markdown-editor/media-src/node_modules/vditor/src/ts/toolbar/index.ts`, lines 74–162)

`MenuItem`, `Emoji`, `Headings`, `Divider`, `Br`, `Undo`, `Redo`, `Help`, `Both`, `Preview`, `Fullscreen`, `Upload`, `Record`, `Info`, `EditMode`, `Devtools`, `Outdent`, `Indent`, `Outline`, `InsertAfter`, `InsertBefore`, `CodeTheme`, `ContentTheme`, `Export`, `Custom`.

### Set difference — items Vditor ships but we never use

| Vditor item | Source file | LOC | Transitive cost |
|---|---|---|---|
| `Br` | `/Users/kish.sachdeva/Documents/repos/vscode-markdown-editor/media-src/node_modules/vditor/src/ts/toolbar/Br.ts` | 8 | trivial |
| `Fullscreen` | `/Users/kish.sachdeva/Documents/repos/vscode-markdown-editor/media-src/node_modules/vditor/src/ts/toolbar/Fullscreen.ts` | 61 | pulls `setPadding`, `setTypewriterPosition` from `ui/initUI` (already used elsewhere) |
| `Record` | `/Users/kish.sachdeva/Documents/repos/vscode-markdown-editor/media-src/node_modules/vditor/src/ts/toolbar/Record.ts` | 61 | pulls `MediaRecorder` polyfill paths |
| `Export` | `/Users/kish.sachdeva/Documents/repos/vscode-markdown-editor/media-src/node_modules/vditor/src/ts/toolbar/Export.ts` | 41 | imports `exportHTML, exportMarkdown, exportPDF` from `../export/index.ts` (79 LOC, includes PDF generation paths) — the heaviest transitive drop |

`Counter` is conditional on `options.counter.enable` (we don't enable it). Items still pulled into the case statement but never matched: same as above — `Br`, `Fullscreen`, `Record`, `Export`.

Note: Vditor's `mergeToolbar` (`Options.ts` line 161+) maps strings → default item objects; it does NOT inject default items into the user-supplied array — it only fills in icons/hotkeys for the strings the user passed. So our 22 top-level items + 7 submenu items is exactly what gets rendered.

---

## Q2 — Vditor's tree-shake friendliness

**Verdict: NOT tree-shakeable as shipped from npm.** Three independent reasons:

1. **Pre-bundled UMD only**, no ESM entry. `/Users/kish.sachdeva/Documents/repos/vscode-markdown-editor/media-src/node_modules/vditor/package.json` declares only `"main": "dist/index.min.js"` (line 8). No `module`, no `exports` map, no `sideEffects: false`. esbuild will resolve `import Vditor from 'vditor'` to the 272 KB pre-minified blob and treat it as one opaque side-effectful chunk. `dist/index.min.js` is 272,712 bytes, header confirms it's a Webpack-bundled UMD.
2. **Static-import graph at source level, BUT runtime string-dispatch.** `toolbar/index.ts` lines 1–28 statically `import` every button class at the top. Then the `genItem` switch (lines 74–162) dispatches by `menuItem.name` string. So even if we pointed esbuild at Vditor's TS sources, the `import` statements at top of `toolbar/index.ts` are unconditional — esbuild cannot prove `Br`, `Fullscreen`, `Record`, `Export` are dead. They each have a `new ClassName(...)` call site behind a `case` branch, which is a live reference. Tree-shaking won't elide them.
3. **No `sideEffects: false` declaration.** Even with a stub-modules trick, bundlers conservatively keep imported modules in case they have side effects.

Evidence of static imports: `toolbar/index.ts` lines 1–28 list 22 button classes; `src/index.ts` lines 19–21 import `Toolbar` and helpers from `toolbar/`; `ui/initUI.ts` line 2 imports `setEditMode` from `toolbar/EditMode`.

---

## Q3 — Recommendation

### Pick: **A (esbuild alias to stub unused button modules) — but only by switching the import to Vditor's TS sources.**

Pure option A on the published npm package is impossible (Q2 reason #1 — `main` points at a pre-minified blob). However, Vditor publishes its `src/` to npm too (see `package.json` line 10–16 `"files": ["dist/*", "src/index.ts", "src/method.ts", "src/ts/*", "src/assets/*"]`). So a viable hybrid:

**Implementation sketch**:
1. In `media-src/src/main.ts` change `import Vditor from 'vditor'` to `import Vditor from 'vditor/src/index.ts'` (esbuild will happily compile the TS).
2. Add an esbuild `--alias` (or `alias` plugin entry in a small `build.mjs`) mapping each unused button file to a stub:
   - `vditor/src/ts/toolbar/Br.ts` → empty `export class Br {}`
   - `vditor/src/ts/toolbar/Fullscreen.ts` → empty stub
   - `vditor/src/ts/toolbar/Record.ts` → empty stub
   - `vditor/src/ts/toolbar/Export.ts` → empty stub (this also frees `vditor/src/ts/export/index.ts` if no other importer)
3. Side-effect: now esbuild minifies Vditor itself, which means the bundle stops shipping Vditor's already-minified-once code and re-minifies the whole graph — likely cheaper bytes overall, possibly cheaper than just stubbing.
4. Risk: switching to source breaks if Vditor's TS uses `tsc`-only features esbuild can't compile (e.g. decorators with specific tsconfig). Need a smoke-test build before adopting.

If risk of (3) is too high, fall back to **C (config-only trim)** — but as Q2 shows, that produces zero KB savings. We already don't reference `br`, `fullscreen`, `record`, `export` in our config, so there's nothing to trim.

**Why not B (vendor a stripped Vditor)**: same wins as A but with the burden of maintaining a fork. A is mechanically equivalent with less ongoing cost.

**Why not D**: A is achievable, just requires switching the entry point.

---

## Q4 — Adjacent wins (much bigger payoff than toolbar)

Greppped `dist/index.min.js`: references to `mermaid`, `katex`, `echarts`, `abcjs`, `graphviz`, `hljs/highlight` appear only as URL strings (2–17 occurrences each). These libs are **NOT bundled** — Vditor loads them on demand via `addScript()` (see `media-src/node_modules/vditor/src/ts/markdown/highlightRender.ts` line 31, `chartRender.ts`, `mermaidRender.ts`, etc.) from `Constants.CDN` at runtime. Confirmed: `grep -c addScript dist/index.min.js` = 0 in our scan but `grep createElement` shows 123 hits including dynamic script tag creation. Either way the heavy libs aren't in `main.js`.

So the bundle weight is genuinely just Vditor core + lute setup + IR/SV/WYSIWYG engines + DOM event handling. No CDN feature is dead-code we could prune.

Other potentially droppable Vditor surface (visible in `src/index.ts` lines 1–30): `sv/` (split view) and `ir/` (instant rendering) editor modes — our app uses one mode at a time. Stubbing the other two modes via the same alias trick could save more than the toolbar trim. Out of scope for this task but flagged.

Also: `/Users/kish.sachdeva/Documents/repos/vscode-markdown-editor/media-src/node_modules/vditor/dist/index.css` is 36 KB. Bundle includes `'vditor/dist/index.css'` (main.ts line 14). Worth checking PurgeCSS pass separately.

---

## Expected payoff

Toolbar-only trim (A): stub `Br`, `Fullscreen`, `Record`, `Export`, and `export/index.ts`. Source LOC removed ≈ 8 + 61 + 61 + 41 + 79 = **250 LOC of TS**. After esbuild minify, realistic shave: **3–8 KB** out of 408 KB (sub-2%). The single biggest contributor is `Export` (drops the PDF/HTML export utilities transitively).

If switching to source-import causes esbuild to re-minify the whole Vditor graph at our minify settings instead of shipping Vditor's pre-minified blob: **bonus 10–30 KB** is plausible (esbuild typically beats webpack's terser output by ~5–10%), but uncertain — would need an actual benchmark build to confirm.

If we extend the same alias trick to one editor mode (drop `sv/` or `ir/` from `src/index.ts`): possibly **20–60 KB**, but that's beyond the toolbar scope of this task.

**Bottom-line estimate for the toolbar-only win: 5 KB ± 3 KB.** Honest answer: the toolbar buttons are small. The juice is in switching to source-import (unlocks future trims) or in editor-mode stripping, not in the four unused buttons themselves.
