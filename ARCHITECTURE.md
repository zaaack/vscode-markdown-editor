# Architecture

One-page overview of how Better Markdown Editor is wired together. Read this
before making a non-trivial change.

## The two halves

The extension is split across two processes that talk via VS Code's webview
message channel:

```
┌────────────────────────────────────┐         ┌────────────────────────────────────┐
│   Extension host (Node.js)         │ JSON    │   Webview (Electron Chromium)      │
│   src/extension.ts                 │◀───────▶│   media-src/src/main.ts            │
│   ↓ compiles to                    │ messages│   ↓ bundles to                     │
│   out/extension.js  (~22 KB)       │         │   media/dist/main.js  (~360 KB)    │
│                                    │         │                                    │
│   • registers commands             │         │   • instantiates Vditor            │
│   • opens the webview panel        │         │   • renders the WYSIWYG view       │
│   • reads workspace settings       │         │   • forwards user actions back     │
│   • applies WorkspaceEdits         │         │     to the host                    │
│   • saves images to disk           │         │                                    │
└────────────────────────────────────┘         └────────────────────────────────────┘
```

- **Host code** (`src/`) imports only `vscode` and `path`. It's tiny on
  purpose (see `bench/results.md` — 21 KB compiled, 2 imports). The host
  doesn't load the webview bundle at activation; the bundle only enters
  memory the first time the user opens a markdown document with our editor.
- **Webview code** (`media-src/src/`) is where Vditor lives. It runs in an
  isolated Electron-Chromium iframe and has no direct VS Code API access.
  Everything it needs (settings, file contents, save acknowledgements) comes
  through the message channel.
- **Bundling**: `media-src/build.mjs` drives esbuild to produce
  `media/dist/main.js` and `main.css`. Notable bits in the build config:
  Vditor is imported from `'vditor/src/index'` (not the prebundled UMD) so
  esbuild can re-minify the graph and strip four unused button modules via
  an `onResolve` plugin (see `media-src/src/stubs/vditor-toolbar-stubs.ts`).

## Two host classes — `EditorPanel` and `MarkdownEditorProvider`

`src/extension.ts` exposes two ways to open a markdown document, each backed
by its own host class:

| Class | Triggered by | VS Code API |
|---|---|---|
| `EditorPanel` | the `markdown-editor.openEditor` command (palette / keybinding / explorer right-click) | `vscode.window.createWebviewPanel` |
| `MarkdownEditorProvider` | *Open With…* / setting it as the default `.md` editor | `vscode.window.registerCustomEditorProvider` |

The two classes are **near-duplicates** of each other — same HTML template,
same message handlers, same options envelope. They exist because VS Code's
custom-editor API didn't exist when the upstream project started, and the
duplication is queued for consolidation (see TODO.md → Code health).

If you're modifying behavior that affects "opening a document", you almost
always need to touch **both** classes. The tests in
`test/backend/webview-html.test.ts` and `test/backend/extension.test.ts`
exist partly to catch drift between the two.

## The message protocol

Every message has `{ command: string, ...payload }`. Discovered in
`src/extension.ts` (handlers) and `media-src/src/main.ts` + `utils.ts`
(senders).

**Host → webview** (`webview.postMessage`):

| Command | Payload | Sent when |
|---|---|---|
| `update` | `{ type: 'init' \| undefined, content, options?, theme? }` | Document opened (`type='init'`), VS Code's color theme changed (`type='init'`), or text changed in the underlying file while the webview is inactive (no `type`). |
| `uploaded` | `{ files: string[] }` | Reply to an `upload` from the webview — relative paths the webview can now `![](...)`-reference. |

**Webview → host** (`vscode.postMessage`):

| Command | Payload | Sent when |
|---|---|---|
| `ready` | — | Webview loaded; host responds with `update` `type='init'`. |
| `edit` | `{ content }` | Debounced 250 ms after the user types in Vditor. Host applies a `WorkspaceEdit` replacing the whole document. |
| `save` | `{ content }` | Cmd+S in the webview. Host applies the edit and calls `document.save()`. |
| `save-options` | `{ options }` | Vditor settings changed (mode, theme, preview config). Persisted to `globalState.vditor.options`. |
| `reset-config` | — | "Reset config" toolbar item. Host clears `globalState.vditor.options`. |
| `upload` | `{ files: [{ name, base64 }] }` | Image pasted / dragged / uploaded. Host writes them under the `imageSaveFolder` and replies with `uploaded`. |
| `open-link` | `{ href }` | Anchor click. Host opens via `vscode.open`. |
| `find` | — | Cmd+F from the toolbar. Host invokes `editor.action.webvieweditor.showFind`. |
| `info` / `error` | `{ content }` | Show a VS Code toast. |

## Options flow (`markdown-editor.*` settings → DOM)

```
1. workspace.getConfiguration('markdown-editor')           — extension reads
2. options envelope assembled at three init sites in        — extension packs
   src/extension.ts (EditorPanel constructor's
   onDidChangeActiveColorTheme + 'ready' handler,
   MarkdownEditorProvider's 'ready' handler)
3. webview.postMessage({ command: 'update', type: 'init',  — sent
   options })
4. main.ts's `case 'update'` with `type === 'init'`        — webview receives
   sets:
     • body[data-use-vscode-theme-color]
     • body[data-highlight-headings]
     • body[data-highlight-headings-per-level]
     • body[data-highlight-table-headers]
     • body[data-outline-max-depth]
     • body.style.--bme-heading-bg  (CSS custom property)
     • body.style.--bme-heading-fg
5. main.css selectors keyed on those attributes apply       — DOM renders
   visible styling. Vditor itself receives outline.position,
   theme, mode, preview config via initVditor()'s
   `defaultOptions`.
```

If you add a new setting:

1. Declare it in `package.json` under `contributes.configuration.properties`.
2. Forward it from **all three** init sites in `src/extension.ts` (search
   for `useVscodeThemeColor` to find the sites — they're the canonical
   template).
3. Add a key to `mockConfigDefaults` in `test/backend/vscode-mock.ts` so
   tests that don't set it get a sane fallback.
4. Update `test/backend/manifest.test.ts`'s setting-count assertion + add a
   focused test for the default + type.
5. Apply the setting in `media-src/src/main.ts` (body attribute, CSS
   variable, or `initVditor` merge depending on what the setting controls).
6. Add a focused test in `test/frontend/message-handler.test.ts` replicating
   the handler logic and pinning the body attribute / property write.

## Save flow

```
user types in Vditor
    │
    │ Vditor `input` callback fires on each keystroke
    ▼
debounce in main.ts (EDIT_DEBOUNCE_MS = 250 ms in media-src/src/config.ts)
    │
    │ vscode.postMessage({ command: 'edit', content: vditor.getValue() })
    ▼
extension host case 'edit'
    │
    │ guards on panel.active (don't sync if the webview is the active editor
    │ being edited from VS Code's side — circular update prevention)
    │
    │ WorkspaceEdit.replace(uri, Range(0,0, doc.lineCount,0), content)
    │ workspace.applyEdit(edit)
    ▼
VS Code re-tokenizes the buffer; document.isDirty becomes true
    │
    │ updateEditTitle() sets the panel title to "[edit]filename.md"
    ▼
user hits Cmd+S → command 'save' → applyEdit + document.save()
```

The full-document `WorkspaceEdit.replace` on every keystroke is the
biggest known overhead. It's bounded by VS Code IPC + tokenizer, not the
extension's JS — see `bench/results.md`'s "full document replace scaling"
benches, which show ~32 ns of JS work regardless of doc size.

## Where state lives

- **`vscode.workspace.getConfiguration('markdown-editor')`** — user-facing
  settings. Authoritative source. Read once per init.
- **`context.globalState.get('vditor.options')`** — Vditor's *internal*
  options that survive across sessions (`theme`, `mode`, `preview`). Saved
  via `saveVditorOptions()` in `media-src/src/utils.ts`. **Watch out:** this
  is spread into the options envelope *after* the workspace config in
  `src/extension.ts`, which means a saved Vditor option silently overrides
  the user's per-workspace setting. This bit us when implementing
  `outlinePosition` — kept the bug in `TODO.md` under "Documentation" so
  future work knows about it.
- **Webview DOM** — ephemeral. Vditor regenerates the editor DOM on every
  keystroke in IR mode. Any external mutations (e.g. heading-folding state)
  need to be re-applied via `MutationObserver` after each render.

## How a regression usually slips in

1. **Touching one of `EditorPanel` / `MarkdownEditorProvider` but not the
   other.** The webview-html and message-protocol tests catch the easy
   cases; the harder cases (forgetting to forward a new setting from the
   third init site) bite only at runtime. Always grep for the existing
   setting names when adding a new one.
2. **`vditor.options` globalState overriding a workspace setting.** See
   above.
3. **esbuild defaults that differ from Vditor's webpack build.** We hit
   `VDITOR_VERSION is not defined` and the class-fields/`appendChild`
   crash when switching to source-import; see `media-src/build.mjs` for
   the `define` + `tsconfigRaw.useDefineForClassFields` mitigations.
4. **The webview bundle isn't auto-rebuilt by `vsce package`.** A change
   to `media-src/src/*` requires `node media-src/build.mjs` before
   packaging. Same for `src/*` and `npx tsc -p .`. The `bench/test-plan.md`
   smoke checklist exists partly to catch a stale-bundle release.

## File-by-file map

```
src/extension.ts          — host. EditorPanel + MarkdownEditorProvider + activate()
out/extension.js          — compiled output (gitignored)
media-src/build.mjs       — esbuild driver (define VDITOR_VERSION, stub plugin,
                            useDefineForClassFields=false)
media-src/src/main.ts     — webview entry. Receives `update`, initializes Vditor,
                            wires save/edit/upload callbacks.
media-src/src/main.css    — webview styles. Heading-highlight band, custom
                            properties, outline-depth selectors.
media-src/src/toolbar.ts  — toolbar item array (custom + Vditor built-ins)
media-src/src/utils.ts    — webview helpers (fileToBase64, fixLinkClick, …).
                            Imports jQuery + jquery-confirm; the heaviest
                            non-Vditor dep at 300 KB and a known cleanup target.
media-src/src/config.ts   — webview-side constants (EDIT_DEBOUNCE_MS).
media-src/src/stubs/vditor-toolbar-stubs.ts  — empty classes that replace
                            Vditor's Br/Fullscreen/Record/Export buttons.
media/dist/main.{js,css}  — built webview output (committed; not gitignored
                            because the `.vsix` packages from this path).
test/backend/             — vitest tests for the host (vscode-mock + message
                            protocol + webview HTML + manifest).
test/frontend/            — vitest tests for the webview (jsdom env).
test/perf/                — vitest benches + bundle-size regression guards.
bench/                    — benchmark results, before/after comparisons,
                            test-plan, toolbar-tree-shake analysis.
```
