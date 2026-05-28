# Manual test plan (changes since `fe1d89b`)

Built and installed from branch `audit/dispose-cleanup` — includes everything on `master` since `fe1d89b` plus the dispose-audit work that hasn't been merged yet.

**To activate the new build:** reload VS Code (Cmd+Shift+P → *Developer: Reload Window*). Then open any `.md` file with Better Markdown Editor.

Use a long markdown file (a few hundred lines, several headings) for most of the checks below — the long-document features are the ones that changed.

---

## 1. Outline button promoted to top toolbar (`fe1d89b`)

**Setup:** open a markdown file with multiple H1/H2/H3 headings.

- [X] An outline icon (3 horizontal lines) appears in the top toolbar, immediately to the right of the Find (🔍) icon.
- [X] Clicking it opens Vditor's outline side panel.
- [X] The outline lists every heading in the document.
- [X] Clicking any heading in the outline scrolls the editor to that section.
- [X] Clicking the outline icon again closes the panel.
- [X] The "more" overflow menu (⋯) no longer contains "outline" — it was moved out of there.

## 2. Heading highlight setting (`f1d4619`)

**Setting:** `Markdown Editor: Highlight Headings` (default OFF).

- [X] With the setting OFF: headings render with default Vditor styling. Nothing unusual.
- [X] Toggle the setting ON and reopen the file.

## h2

### h3

#### h4

- [X] All headings (h1–h6) now have a tinted background band and a distinct foreground color.
- [X] Switch VS Code to a light theme → the band remains readable (uses `--vscode-editor-selectionHighlightBackground` so it adapts).
- [X] Switch to a dark theme → still readable.
- [X] Switch to a high-contrast theme → still readable.
- [X] Toggle the setting OFF and reopen — band disappears, headings revert.

## 3. Outline panel position setting (`f875852`)

**Setting:** `Markdown Editor: Outline Position` (enum `left` | `right`, default **`right`**).

- [X] Default (`right`): clicking the outline icon opens the panel on the **right** side of the editor.
- [X] Change setting to `left`, reload, reopen file.
- [X] Now the outline opens on the **left** instead.
- [X] Heading clicks still scroll to the right place from either side.

## 4. Activation behavior (`35df9c1`)

The extension used to activate on `onLanguage:markdown` (every time any markdown file opened). That event was removed.

- [X] Close all markdown editors. Open Cmd+Shift+P → *Developer: Show Running Extensions*.
- [X] The extension should NOT be "activated" yet.
- [X] Open a markdown file with the regular (text) editor → extension should still not be activated.
- [ ] bbbbbb
- [X] Right-click the file → *Open With…* → Better Markdown Editor. Now it activates.
- [ ] Run *Better Markdown Editor: Open with Better Markdown Editor* from the palette directly on a `.md` file → also activates.

Smoke check that nothing got broken: all five entry points from the README's usage table should still open the editor (command palette, Cmd+Shift+Alt+M shortcut, explorer right-click, editor tab right-click, *Open With…* default editor).

## 5. Edit debounce 100 → 250 ms (`76bbe8d`)

Subjective check — debounce was bumped to reduce extension-host chatter on long typing bursts.

- [X] Type a long paragraph at normal speed in the WYSIWYG view, then switch to the underlying text editor (split view).
- [X] Updates should still appear in the text editor; latency between stopping typing and the text editor reflecting it should feel like ~quarter of a second, not instant.
- [X] No visible "lag" while typing (the 250 ms is below typist-perceptible thresholds).
- [X] No lost characters — what you typed in the WYSIWYG view should match what ends up in the text buffer.

## 6. Vditor source-import + toolbar tree-shake (`4fcd1ef`)

Bundle **dropped** from 408 KB to 366 KB. Functionality should be identical — this is the highest-risk change because esbuild is now re-minifying Vditor instead of consuming the upstream pre-minified blob.

Smoke-test the full Vditor feature surface to catch any regression from the re-minify:

- [X] **Save** (Cmd+S) writes to the underlying file. Title shows `[edit]` marker before save, plain title after.
- [X] **Find** (Cmd+F) opens the find widget. Search highlights matches.
- [ ] **Headings** dropdown (H1–H6 selector) works.
- [ ] **Bold / Italic / Strike / Link** toolbar buttons all toggle correctly.
- [ ] **Lists** — bulleted, ordered, and todo (checkbox) lists.
- [ ] **Outdent / Indent** on nested lists.
- [ ] **Quote**, **horizontal line**, **code block**, **inline code**.
- [ ] **Insert table** — opens the table size picker, inserts a markdown table.
- [ ] **Upload image** — drag/paste an image into the editor. Saves under `assets/`, inserts `![](assets/...)`.
- [ ] **Undo / Redo**.
- [ ] **Edit mode** dropdown — IR / WYSIWYG / split-screen all switch cleanly.
- [ ] **"More" submenu** (⋯): code-theme, content-theme, preview, devtools, info, help all open something appropriate.
- [ ] **Copy as markdown** and **Copy as HTML** from the "more" submenu both put the right content on the clipboard.
- [ ] **Reset config** prompts a confirmation, then resets to defaults.
- [ ] **Math** — `$E=mc^2$` inline and `$$ ... $$` block render as KaTeX.
- [ ] **Mermaid** — a ` ```mermaid` code block with `graph TD; A-->B` renders as a diagram (loaded from CDN at runtime — needs network).
- [ ] **No console errors** in the webview devtools after a few interactions.

## 7. Dispose / listener cleanup (`e7668c9`)

This is harder to user-test directly — it fixes leaks that don't show up unless you cycle the editor many times. Approximate check:

- [ ] Open a markdown file with our editor. Edit something. Close the tab.
- [ ] Open the SAME file again. Edit something else. Close.
- [ ] Repeat 5–10 times rapidly. The editor should still open cleanly each time. No "ghost" updates from previous sessions appearing.
- [ ] Open Cmd+Shift+P → *Developer: Toggle Developer Tools* → Console while the editor is up. After closing and reopening the editor several times, the console should not be accumulating `_update()` errors or `Cannot read property X of disposed webview`-type warnings.

## 8. Settings — full surface

All five settings should appear in the VS Code settings UI under "Better Markdown Editor":

- [ ] `Image Save Folder` — string, default `"assets"`
- [ ] `Use Vscode Theme Color` — boolean, default `true`
- [ ] `Highlight Headings` — boolean, default `false` (new)
- [ ] `Outline Position` — enum dropdown with `left` / `right`, default `right` (new)
- [ ] `Custom CSS` — string, default empty (description now filled in)

Every one of these should have a description visible in the settings UI (this was a quiet fix in `35df9c1`).

---

## Quick smoke command

Compact happy path that exercises most surfaces in ~60 s:

1. Reload window.
2. Open a sample.md with 3 headings + a code block + a math block + a mermaid block.
3. Click outline icon → confirm panel opens on the right (default).
4. Click a heading in the outline → confirms jump.
5. Cmd+F → search for a word → confirm highlight.
6. Toggle "Highlight Headings" in settings → reopen → confirm band.
7. Edit a heading → save with Cmd+S → confirm title's `[edit]` marker clears.
8. Close tab, reopen file → confirm it loads cleanly.

If all eight checks pass, the build is good to merge to `master`.
