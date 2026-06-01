# Changelog

All notable changes to **Better Markdown Editor** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] — 2026-05-31

First marketplace release of the Better Markdown Editor fork. Focused on
**performance, navigation, and customizability** improvements on top of the
inherited [vscode-markdown-editor](https://github.com/zaaack/vscode-markdown-editor)
base.

### Added

- **One-click outline navigation.** Vditor's document outline is now a top-level
  toolbar button (between Find and Edit-Mode) instead of being buried in the
  "more" overflow menu.
- **`markdown-editor.outlinePosition`** setting (`"left"` | `"right"`, default
  `"right"`) — controls which side the outline panel opens on.
- **`markdown-editor.highlightHeadings`** setting (boolean, default `false`) —
  when on, h1–h6 render with a themed background and foreground color for
  easier section scanning on long documents.
- **`markdown-editor.headingHighlightBackground`** and
  **`markdown-editor.headingHighlightForeground`** — accept any CSS color to
  override the highlight band. Empty string keeps the existing
  `--vscode-editor-selectionHighlightBackground` / `--vscode-editor-foreground`
  fallback so themes still adapt.
- **`markdown-editor.headingHighlightPerLevel`** setting (boolean, default
  `false`) — when on, H1 keeps the full-strength band and each deeper level
  fades it (H2 80%, H3 60%, H4 45%, H5 30%, H6 20%) so the document hierarchy
  reads at a glance.
- **`Cmd+F` / `Ctrl+F`** now opens VS Code's Find widget inside the editor
  webview (custom editor and command-palette panel both supported).
- **Custom Text Editor support.** Better Markdown Editor can be used via
  *Open With…* and set as the default `.md` editor.
- **Vitest test infrastructure.** 131 tests covering message-protocol
  round-trips, the toolbar shape, webview HTML structure, dispose-handler
  cleanup, debounce contract, manifest declarations, and a bundle-size /
  CSS-minification regression guardrail.

### Changed

- **Webview bundle reduced from 805 KB → 366 KB** (−55%) compared to the
  upstream baseline. Two contributing changes:
  - Re-minifying Vditor's TS source under our esbuild settings (≈42 KB win;
    we previously consumed Vditor's pre-bundled UMD).
  - Stubbing four unused Vditor toolbar button modules (`Br`, `Fullscreen`,
    `Record`, `Export`) via an esbuild `onResolve` plugin.
- **Edit-message debounce raised from 100 ms → 250 ms** — roughly halves the
  extension-host message volume during sustained typing, still well under
  the perceptible-lag threshold.
- **Activation events narrowed.** Dropped `onLanguage:markdown` — the
  extension no longer activates merely because *any* markdown file was
  opened. Now activates only on our command, the custom editor, or a
  restored webview.
- Repository URL and clone instructions point at the fork.
- `Better Markdown Editor` branding throughout (publisher, commands, titles).

### Fixed

- **Listener leak in `EditorPanel`.** Two `workspace.on…` listeners were
  passing the disposables array in the `thisArgs` slot of the VS Code event
  API instead of the `disposables` slot, so they were never tracked for
  cleanup. Each panel open used to leak a pair of subscriptions; now they're
  properly disposed.
- **Stale `setTimeout` after panel disposal.** The 300 ms debounce that
  defers `_update()` after a text-document change was scoped to the
  constructor instead of the instance, so `dispose()` couldn't clear it. A
  pending timer could fire on a disposed webview. Promoted to an instance
  field and cleared in `dispose()`.
- README no longer has the "Local Development / Installation" section
  duplicated.

### Performance & measurement

- Initial benchmark baseline captured in `bench/results.md` (bundle sizes,
  microbench percentiles, build/test wall-clocks).
- Before/after comparison for the toolbar tree-shake in `bench/after.md`.
- Local CI guardrail: vitest test that fails the suite if `media/dist/main.js`
  exceeds 500 KB or stops being minified, and the same for `main.css` at
  80 KB.

### Acknowledgements

This release builds on the excellent
[Vditor](https://github.com/Vanessa219/vditor) WYSIWYG markdown engine by
[@Vanessa219](https://github.com/Vanessa219) and the original
[vscode-markdown-editor](https://github.com/zaaack/vscode-markdown-editor)
integration by [@zaaack](https://github.com/zaaack). All core editing
functionality originates from those projects.

---

## 0.1.x — Pre-marketplace

Earlier `0.1.x` tags carry the rebrand and fork-bootstrapping work
(test infrastructure, search support, custom editor wiring, initial bundle
reduction, local-install docs). See `git log v0.2.0..HEAD` for details. No
marketplace publication was done from these versions.
