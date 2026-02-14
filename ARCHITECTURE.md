# VS Code Markdown Editor - Architecture Documentation

## Overview

This is a **dual-mechanism VS Code markdown editor extension** that provides a WYSIWYG editing experience using the [Vditor](https://github.com/Vanessa219/vditor) markdown editor library (v3.8.4). The extension uses two complementary registration methods to integrate with VS Code:

1. **EditorPanel (Command-based)** - Traditional webview panel opened via command
2. **MarkdownEditorProvider (Custom Editor)** - "Open With" integration for markdown files

## Architecture Diagram

```
VS Code Extension (Node.js)
├── Extension Host
│   └── src/extension.ts
│       ├── EditorPanel class (manages webview panels)
│       │   ├── Webview HTML injection
│       │   ├── Message routing (edit, save, upload, etc.)
│       │   └── Document synchronization
│       └── MarkdownEditorProvider class (CustomTextEditorProvider)
│           ├── Document lifecycle management
│           ├── Two-way sync (editor ↔ webview)
│           └── Shared message handlers
│
└── Webview (Browser Context)
    └── media-src/src/main.ts (compiled to media/dist/main.js)
        ├── Vditor editor instance
        ├── Toolbar (media-src/src/toolbar.ts)
        ├── Message handlers
        ├── Upload handling (base64 encoding)
        └── Utilities (utils.ts, fix-table-ir.ts, lang.ts)
```

## 1. Overall Architecture

### Extension Type: **Custom Editor + Webview Panel**

This extension implements both:
- **Custom Editor API**: Provides "Open With" integration for `.md` and `.markdown` files
- **Webview Panel API**: Provides command-based editor panel opening

### Why Both?

- **Custom Editor** provides native VS Code integration for the default markdown handler
- **Webview Panel** provides backward compatibility and command palette access

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Extension | TypeScript → CommonJS, Node.js APIs |
| Webview | TypeScript → ESNext, Browser APIs |
| Editor | Vditor 3.8.4 (markdown editor) |
| UI Dialogs | jQuery + jquery-confirm |
| Bundler | esbuild (webview), tsc (extension) |
| Build Orchestration | Foy task runner |
| Target | VS Code ^1.47.0 |

## 2. VS Code Registration

### 2.1 Package.json Contributes Section

```json
{
  "contributes": {
    "commands": [
      {
        "command": "markdown-editor.openEditor",
        "title": "Open with markdown editor",
        "category": "markdown-editor"
      }
    ],
    "menus": {
      "explorer/context": [{
        "when": "resourceLangId == markdown",
        "command": "markdown-editor.openEditor",
        "group": "navigation"
      }],
      "editor/title/context": [{
        "when": "resourceLangId == markdown",
        "command": "markdown-editor.openEditor",
        "group": "1_open"
      }]
    },
    "customEditors": [
      {
        "viewType": "markdown-editor.customEditor",
        "displayName": "Markdown Editor",
        "selector": [
          {"filenamePattern": "*.md"},
          {"filenamePattern": "*.markdown"}
        ],
        "priority": "option"
      }
    ],
    "configuration": {
      "properties": {
        "markdown-editor.imageSaveFolder": {
          "type": "string",
          "default": "assets",
          "description": "Folder for uploaded images (relative to markdown file or ${projectRoot}/assets)"
        },
        "markdown-editor.useVscodeThemeColor": {
          "type": "boolean",
          "default": true,
          "description": "Use VS Code theme background in editor"
        },
        "markdown-editor.customCss": {
          "type": "string",
          "default": ""
        }
      }
    },
    "keybindings": [
      {
        "key": "ctrl+shift+alt+m",
        "mac": "cmd+shift+alt+m",
        "command": "markdown-editor.openEditor",
        "when": "editorTextFocus && editorLangId == markdown"
      }
    ]
  }
}
```

### 2.2 Context Menu Integration

The extension provides two ways to open markdown files:

1. **Explorer Context Menu**: Right-click markdown file → "Open with markdown editor"
2. **Editor Title Context Menu**: Right-click editor tab for markdown → "Open with markdown editor"
3. **Keyboard Shortcut**: `Ctrl+Shift+Alt+M` (or `Cmd+Shift+Alt+M` on Mac)
4. **Open With**: Right-click markdown file → "Open With" → "Markdown Editor"

## 3. Activation Events and Entry Point

### 3.1 Activation Events

```json
"activationEvents": [
  "onCommand:markdown-editor.openEditor",
  "onWebviewPanel:markdown-editor",
  "onLanguage:markdown",
  "onCustomEditor:markdown-editor.customEditor"
]
```

| Event | Triggered When |
|-------|---|
| `onCommand:markdown-editor.openEditor` | User runs the command (context menu, keybinding) |
| `onWebviewPanel:markdown-editor` | Restoring a webview panel from saved state |
| `onLanguage:markdown` | Opening any markdown file |
| `onCustomEditor:markdown-editor.customEditor` | Using "Open With" → "Markdown Editor" |

### 3.2 Main Entry Point

- **File**: `src/extension.ts`
- **Compiled Output**: `out/extension.js` (CommonJS)
- **Export**: `activate()` and `deactivate()` functions

```typescript
export function activate(context: vscode.ExtensionContext) {
  // Register EditorPanel command handler
  // Register MarkdownEditorProvider custom editor
}

export function deactivate() {}
```

## 4. How Markdown Files Are Opened and Rendered

### 4.1 Two Opening Mechanisms

#### Mechanism 1: EditorPanel (Command-Based)

```
User triggers command → activate() → EditorPanel.create() 
  → createWebviewPanel() → HTML injection → Vditor initialization
```

**Flow**:
1. `activate()` registers "markdown-editor.openEditor" command handler
2. Handler calls `EditorPanel.create(fileUri?, context)`
3. Creates webview panel with `createWebviewPanel()` API
4. Injects HTML from `generateHtml()` method
5. Webview loads compiled `media/dist/main.js`
6. Vditor editor initializes in IR (Immediate Render) mode

**Key Code**:
```typescript
class EditorPanel {
  static async create(fileUri?: vscode.Uri, context?: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
      'markdown-editor',
      'Markdown Editor',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        enableCommandUris: true,
        localResourceRoots: [vscode.Uri.file('/')]  // Allow filesystem access
      }
    );
    
    panel.webview.html = EditorPanel.generateHtml(context);
    // Message routing and lifecycle management
  }
  
  private static generateHtml(context?: vscode.ExtensionContext) {
    // Returns HTML template that loads media/dist/main.js and media/dist/main.css
    // Sets content security policy, base href, initial content
  }
}
```

#### Mechanism 2: MarkdownEditorProvider (Custom Editor)

```
User selects "Open With" → activate() → MarkdownEditorProvider.resolveCustomTextEditor()
  → Document.getText() → postMessage() with initial content → Vditor initialization
```

**Flow**:
1. `activate()` registers `MarkdownEditorProvider` for "markdown-editor.customEditor"
2. User selects "Open With" → "Markdown Editor"
3. VS Code calls `resolveCustomTextEditor(document, webviewPanel, token)`
4. Provider extracts markdown text from document
5. Sends "update" message with content to webview
6. Webview calls `vditor.setValue()` to populate editor

**Key Code**:
```typescript
class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ) {
    // Generate HTML and inject scripts
    webviewPanel.webview.html = EditorPanel.generateHtml(this.context);
    
    // Send initial content
    webviewPanel.webview.postMessage({
      command: 'update',
      content: document.getText(),
      type: 'init'
    });
    
    // Set up message handlers (same as EditorPanel)
    // Listen for document changes
  }
}
```

### 4.2 Webview Rendering Process

**Webview Entry Point**: `media-src/src/main.ts`

```typescript
import { preload } from './preload';  // Fix global reference
import Vditor from 'vditor';
import { toolbar } from './toolbar';

// Initialize Vditor editor
const vditor = new Vditor('app', {
  height: '100%',
  width: '100%',
  mode: 'ir',  // Immediate Render mode
  cache: { enable: false },
  toolbar: toolbar,
  input: (value) => {
    // 100ms debounced send to extension
    vscode.postMessage({ command: 'edit', content: value });
  },
  upload: {
    handler: async (files) => {
      // Convert files to base64, send to extension
      for (const file of files) {
        const base64 = await fileToBase64(file);
        vscode.postMessage({
          command: 'upload',
          file: { name: file.name, base64 }
        });
      }
    }
  }
});

// Message handlers for theme updates, content sync, etc.
window.addEventListener('message', (e) => {
  const { command, content, theme } = e.data;
  
  if (command === 'update') {
    vditor.setValue(content);
  } else if (command === 'theme') {
    vditor.setTheme(theme);
  }
});
```

### 4.3 Bidirectional Message Flow

```
Extension ← → Webview
│
├─ Extension → Webview:
│  ├─ command: 'update' (sync markdown from file)
│  ├─ command: 'theme' (update editor theme)
│  └─ command: 'config' (update configuration)
│
└─ Webview → Extension:
   ├─ command: 'edit' (debounced editor input)
   ├─ command: 'save' (user clicked save button)
   ├─ command: 'upload' (image uploaded)
   ├─ command: 'ready' (webview initialized)
   ├─ command: 'open-link' (user clicked link)
   └─ command: 'error' (error occurred)
```

### 4.4 Image Upload Handling

1. User uploads image in webview
2. Image converted to base64 in webview
3. Webview sends "upload" message to extension
4. Extension creates `imageSaveFolder` (default: "assets/")
5. Extension writes base64-decoded file to disk
6. Extension inserts markdown image reference at cursor: `![filename](path/to/image.png)`
7. Webview receives "uploaded" message with new file path
8. Webview inserts image reference (if not already done)

## 5. Performance Patterns

### 5.1 Lazy Loading and Deferred Initialization

- **Webview Context Retention**: `retainContextWhenHidden: true` keeps webview alive when hidden, avoiding re-initialization
- **Deferred Vditor Init**: Vditor initializes only after webview HTML loads (esbuild compilation on-demand during watch)
- **Debounced Input**: 100ms debounce on editor input to reduce extension message overhead
- **Debounced Toolbar**: 500ms debounce on toolbar interactions (theme, mode changes)

### 5.2 State Management and Sync

- **globalState Persistence**: Editor options (theme, mode, preview) stored in `context.globalState`
- **Document-Scoped Sync**: Custom editor syncs with document state, preventing circular updates
- **Prevents circular sync**: Only syncs to webview when panel is active/focused

### 5.3 Bundling and Minification

**Extension Bundle**:
- TypeScript → CommonJS (tsc)
- Single `out/extension.js` file
- Source maps for debugging
- No external dependencies (uses VS Code APIs only)

**Webview Bundle** (esbuild):
- TypeScript → ESNext (esbuild transpiles and bundles)
- Single `media/dist/main.js` file (~800KB+ including Vditor)
- CSS inlined into JS bundle
- Production build minified with source maps
- Watch mode with live rebuild

### 5.4 Resource Access Control

```typescript
localResourceRoots: [vscode.Uri.file('/')]  // Allow all filesystem access
```

This allows webview to access:
- All drive letters on Windows (C:/, D:/, etc.)
- Entire Unix filesystem on macOS/Linux
- Enables relative image path resolution from markdown file location

## 6. Build System and Bundling Setup

### 6.1 Build Orchestration (Foyfile.ts)

Uses **Foy** task runner (v0.2.5) to orchestrate multi-stage build:

```typescript
// Watch mode: tsc (extension) + pnpm start (webview) in parallel
task('watch', async () => {
  await parallel([
    'tsc -w',                      // Extension TS compilation
    'cd media-src && pnpm start'   // Webview esbuild watch
  ]);
});

// Build mode: Sequential tsc → pnpm build → git add
task('build', async () => {
  await exec('tsc');               // Compile extension
  await exec('cd media-src && pnpm build');  // Build webview
  await exec('git add out media/dist');
});
```

### 6.2 Extension Build (TypeScript)

**Config**: `tsconfig.json`
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2019",
    "lib": ["ES2019"],
    "outDir": "out",
    "sourceMap": true,
    "strict": true,
    "rootDir": "src"
  },
  "exclude": ["node_modules", "media-src", "Foyfile.ts"]
}
```

**Compilation**:
```bash
tsc                    # One-time build
tsc -w                 # Watch mode
```

**Output**: 
- `out/extension.js` (main entry point)
- `out/extension.js.map` (source map)
- TypeScript source → CommonJS (for Node.js)

### 6.3 Webview Build (esbuild)

**Config**: `media-src/package.json`
```json
{
  "scripts": {
    "start": "esbuild src/main.ts --bundle --loader:.scss=css --outfile=../media/dist/main.js --watch --sourcemap",
    "build": "esbuild src/main.ts --bundle --loader:.scss=css --outfile=../media/dist/main.js --minify --sourcemap"
  }
}
```

**Build Process**:
1. **Input**: `media-src/src/main.ts`
2. **Output**: `media/dist/main.js` (single bundle)
3. **Features**:
   - Bundles all dependencies (Vditor, jQuery, lodash, date-fns, etc.)
   - CSS files processed as CSS modules (`.scss=css` loader)
   - Production build minified
   - Both modes include source maps for debugging

**Webview TypeScript Config**: `media-src/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "lib": ["ESNext", "DOM"],
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true  // esbuild does compilation
  }
}
```

### 6.4 Build Output Structure

```
project/
├── src/
│   └── extension.ts
├── out/
│   ├── extension.js         (compiled extension entry)
│   └── extension.js.map
├── media-src/
│   ├── src/
│   │   ├── main.ts          (webview entry)
│   │   ├── preload.ts
│   │   ├── utils.ts
│   │   ├── toolbar.ts
│   │   ├── fix-table-ir.ts
│   │   └── lang.ts
│   ├── tsconfig.json
│   ├── .babelrc
│   └── package.json
└── media/
    ├── index.html           (template)
    └── dist/
        ├── main.js          (compiled webview bundle)
        └── main.js.map
```

### 6.5 Watch Mode Development

During development (`pnpm start` or `npm run watch`):

1. **Extension Watch**: `tsc -w` monitors `src/**/*.ts`, outputs to `out/`
2. **Webview Watch**: `esbuild --watch` monitors `media-src/src/**/*.ts`, outputs to `media/dist/`
3. **Both processes run in parallel** in the same terminal
4. **VS Code Extension Host reloads** when `out/extension.js` changes
5. **Webview reloads** when `media/dist/main.js` changes (auto-reload via VS Code webview protocol)

## 7. File-by-File Breakdown

### Extension Files

#### `src/extension.ts` (Main Entry Point)
- **export function activate(context)**: Registers two handlers
  - Command handler for `markdown-editor.openEditor`
  - Custom editor provider for markdown files
- **EditorPanel class**: Manages traditional webview panels
  - `static create()`: Creates new webview panel
  - `static generateHtml()`: Generates HTML with injected scripts
  - Message routing for edit, save, upload, theme changes
- **MarkdownEditorProvider class**: Implements CustomTextEditorProvider
  - Document synchronization in both directions
  - Shared message handlers with EditorPanel

### Webview Files

#### `media-src/src/main.ts` (Webview Entry)
- Vditor instance creation and configuration
- Toolbar configuration from `toolbar.ts`
- Input handler (debounced edit messages)
- Upload handler (base64 encoding)
- Message listener for theme/content updates
- Initialization and setup functions

#### `media-src/src/preload.ts`
- Sets `global.global = window` (CommonJS compatibility fix)

#### `media-src/src/utils.ts`
- `vscode = window.acquireVsCodeApi()`: VS Code API integration
- `confirm()`: jQuery dialog wrapper
- `fixDarkTheme()`: Listens to theme changes, updates Vditor
- `fixPanelHover()`: Adds hover delay to panels
- `fileToBase64()`: Converts files to base64 for transmission
- `saveVditorOptions()`: Persists editor state (theme, mode, preview)
- `handleToolbarClick()`: Saves options after toolbar interactions
- `fixLinkClick()`: Intercepts links, sends to extension for handling
- `fixCut()`: Fixes recursive delete command issue

#### `media-src/src/toolbar.ts`
- Defines Vditor toolbar configuration
- Custom buttons: save, copy-markdown, copy-html, reset-config
- Button positioning and grouping
- Consistent tipPosition and styling

#### `media-src/src/fix-table-ir.ts`
- Adds visual table editing panel for IR mode
- Panel appears on table cell click
- Buttons for cell alignment, insert/delete rows/columns
- Uses keyboard simulation to trigger Vditor table hotkeys
- Dynamic positioning relative to clicked cell

#### `media-src/src/lang.ts`
- Internationalization support
- Detects language from `navigator.language`
- Supported languages: en_US, ja_JP, ko_KR, zh_CN
- Translation lookup with fallback to English

#### `media/index.html` (Development Template)
- Static template for testing
- Contains test markdown content
- Loads compiled CSS and JS from `dist/` folder
- Keyboard event simulation for testing

## 8. Data Flow Diagram

### Opening a Markdown File via Command

```
User right-clicks markdown file
         ↓
Select "Open with markdown editor"
         ↓
Command Handler in extension.ts:activate()
         ↓
EditorPanel.create(fileUri)
         ↓
vscode.window.createWebviewPanel()
         ↓
GenerateHtml() → Inject <script src="dist/main.js">
         ↓
Webview loads media/dist/main.js
         ↓
main.ts executes:
  ├── window.acquireVsCodeApi()
  ├── new Vditor(...) → initialize editor
  ├── Load file content: readFileSync()
  └── vditor.setValue(fileContent)
         ↓
Editor ready with markdown rendered
```

### User Edits Markdown

```
User types in editor
         ↓
Vditor input event fires
         ↓
Debounce 100ms
         ↓
main.ts sends: postMessage({ command: 'edit', content: markdown })
         ↓
Extension receives message
         ↓
EditorPanel.panel.webview.onDidReceiveMessage()
         ↓
Update VS Code editor:
  ├── vscode.TextEdit.replace(fullRange, content)
  ├── Or: sync to custom editor document
         ↓
File marked as modified in VS Code
```

### User Uploads Image

```
User pastes/drags image in editor
         ↓
Vditor upload handler triggers
         ↓
main.ts converts file to base64:
  ├── FileReader.readAsDataURL()
         ↓
Send: postMessage({ command: 'upload', file: { name, base64 } })
         ↓
Extension receives message
         ↓
Create imageSaveFolder (default: "assets/")
         ↓
Decode base64 → write file to disk
         ↓
Get relative path from markdown file
         ↓
Send back: postMessage({ command: 'uploaded', path, file })
         ↓
main.ts receives 'uploaded' message
         ↓
Insert: ![filename](relative/path/image.png)
         ↓
Editor shows image reference with preview
```

## 9. Configuration and Customization

### VS Code Settings

Users can configure:

1. **markdown-editor.imageSaveFolder** (default: "assets")
   - Where uploaded images are saved
   - Supports `${projectRoot}` variable

2. **markdown-editor.useVscodeThemeColor** (default: true)
   - Use VS Code theme background in editor

3. **markdown-editor.customCss** (default: "")
   - Custom CSS to inject into editor

### Vditor Configuration

In `media-src/src/main.ts`:
```typescript
new Vditor('app', {
  height: '100%',
  width: '100%',
  mode: 'ir',                    // Immediate Render (not sv or wysiwyg)
  cache: { enable: false },      // Disable Vditor cache
  toolbar: toolbar,              // Custom toolbar from toolbar.ts
  input: (value) => { ... },     // 100ms debounced input handler
  upload: { handler: ... }       // Image upload handler
})
```

## 10. Key Design Patterns

### 10.1 Singleton Pattern (EditorPanel)
- Only one `currentPanel` instance active at a time
- New opens replace previous panel
- Prevents multiple editor instances

### 10.2 Message Protocol Pattern
- Bidirectional postMessage() for communication
- Commands: 'edit', 'save', 'upload', 'update', 'theme', etc.
- Structured message payload with command, content, metadata

### 10.3 Debouncing Pattern
- 100ms debounce on editor input (reduce overhead)
- 500ms debounce on toolbar interactions
- Prevents excessive extension-webview communication

### 10.4 State Persistence Pattern
- VS Code `globalState` API for editor options
- Options saved when user changes theme/mode/preview
- Restored when editor reopens

### 10.5 Circular Update Prevention Pattern
- Custom editor tracks active panel state
- Only syncs to webview when NOT actively editing
- Prevents document update loops

## Conclusion

This extension demonstrates a production-grade VS Code extension with:
- **Dual integration mechanisms** for maximum compatibility
- **Efficient message-based IPC** between extension and webview
- **Robust build system** with parallel compilation
- **User-friendly features** (image upload, theme sync, toolbar customization)
- **Performance optimization** through debouncing, state retention, and lazy loading
- **Internationalization support** for multiple languages
- **Accessibility features** (theme awareness, custom CSS support)

The architecture balances simplicity (single Vditor instance) with extensibility (configurable toolbar, custom CSS, image handling).
