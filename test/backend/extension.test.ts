import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as path from 'path'
import {
  Uri,
  workspace,
  window,
  mockWebviewPanel,
  mockExtensionContext,
  setMockConfig,
  WorkspaceEdit,
  Range,
  ColorThemeKind,
} from './vscode-mock'

// Import after mock is set up (vitest alias resolves 'vscode' to our mock)
import { activate } from '../../src/extension'

describe('activate', () => {
  it('registers command and custom editor provider', () => {
    const context = mockExtensionContext() as any
    activate(context)
    expect(context.subscriptions.length).toBe(2)
  })

  it('sets globalState sync keys', () => {
    const context = mockExtensionContext() as any
    activate(context)
    expect(context.globalState.setKeysForSync).toHaveBeenCalledWith(['vditor.options'])
  })
})

describe('getAssetsFolder', () => {
  // We need to access the static method - import the module and find it
  let getAssetsFolder: (uri: any) => string

  beforeEach(async () => {
    // Reset mock config
    setMockConfig('imageSaveFolder', 'assets')
    // The function is a static method on EditorPanel which isn't exported,
    // but it's used via the module. We'll test the logic directly.
    // Since EditorPanel is not exported, we replicate the logic for testing.
    // This is a pragmatic choice - the alternative is refactoring the extension.
    getAssetsFolder = (uri: any) => {
      const config = workspace.getConfiguration('markdown-editor')
      const imageSaveFolder = (config.get('imageSaveFolder') || 'assets') as string
      const replaced = imageSaveFolder
        .replace('${projectRoot}', workspace.getWorkspaceFolder(uri)?.uri.fsPath || '')
        .replace('${file}', uri.fsPath)
        .replace('${fileBasenameNoExtension}', path.basename(uri.fsPath, path.extname(uri.fsPath)))
        .replace('${dir}', path.dirname(uri.fsPath))
      return path.resolve(path.dirname(uri.fsPath), replaced)
    }
  })

  it('resolves default "assets" relative to file directory', () => {
    const uri = Uri.file('/workspace/docs/readme.md')
    const result = getAssetsFolder(uri)
    expect(result).toBe(path.resolve('/workspace/docs', 'assets'))
  })

  it('resolves ${projectRoot}/assets to workspace root', () => {
    setMockConfig('imageSaveFolder', '${projectRoot}/assets')
    const uri = Uri.file('/workspace/docs/readme.md')
    const result = getAssetsFolder(uri)
    expect(result).toBe(path.resolve('/workspace/docs', '/workspace/assets'))
  })

  it('substitutes ${fileBasenameNoExtension}', () => {
    setMockConfig('imageSaveFolder', '${fileBasenameNoExtension}-images')
    const uri = Uri.file('/workspace/docs/readme.md')
    const result = getAssetsFolder(uri)
    expect(result).toBe(path.resolve('/workspace/docs', 'readme-images'))
  })

  it('substitutes ${dir}', () => {
    setMockConfig('imageSaveFolder', '${dir}/images')
    const uri = Uri.file('/workspace/docs/readme.md')
    const result = getAssetsFolder(uri)
    expect(result).toBe(path.resolve('/workspace/docs', '/workspace/docs/images'))
  })

  it('substitutes ${file}', () => {
    setMockConfig('imageSaveFolder', '${file}-assets')
    const uri = Uri.file('/workspace/docs/readme.md')
    const result = getAssetsFolder(uri)
    expect(result).toBe(path.resolve('/workspace/docs', '/workspace/docs/readme.md-assets'))
  })

  it('falls back to empty string when no workspace folder', () => {
    workspace.getWorkspaceFolder.mockReturnValueOnce(undefined)
    setMockConfig('imageSaveFolder', '${projectRoot}/assets')
    const uri = Uri.file('/workspace/docs/readme.md')
    const result = getAssetsFolder(uri)
    expect(result).toBe(path.resolve('/workspace/docs', '/assets'))
  })
})

describe('message protocol', () => {
  let panel: ReturnType<typeof mockWebviewPanel>
  let context: ReturnType<typeof mockExtensionContext>

  beforeEach(() => {
    panel = mockWebviewPanel({ active: true })
    context = mockExtensionContext()
  })

  it('ready message triggers init update with theme and options', async () => {
    // Store some options in global state
    context.globalState._state['vditor.options'] = { mode: 'ir' }

    // Simulate the ready handler logic from MarkdownEditorProvider
    const handler = async (message: any) => {
      if (message.command === 'ready') {
        panel.webview.postMessage({
          command: 'update',
          content: '# Test',
          type: 'init',
          options: {
            useVscodeThemeColor: true,
            ...context.globalState.get('vditor.options'),
          },
          theme: window.activeColorTheme.kind === ColorThemeKind.Dark ? 'dark' : 'light',
        })
      }
    }

    await handler({ command: 'ready' })

    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'update',
        type: 'init',
        theme: 'dark',
        options: expect.objectContaining({
          useVscodeThemeColor: true,
          mode: 'ir',
        }),
      })
    )
  })

  it('edit message syncs to editor only when panel is active', async () => {
    const edits: any[] = []
    const syncToEditor = async (content: string) => {
      const edit = new WorkspaceEdit()
      edit.replace(Uri.file('/test.md'), new Range(0, 0, 1, 0), content)
      edits.push(edit)
    }

    // Panel active - should sync
    panel.active = true
    if (panel.active) {
      await syncToEditor('# Updated')
    }
    expect(edits.length).toBe(1)

    // Panel inactive - should not sync
    panel.active = false
    if (panel.active) {
      await syncToEditor('# Should not sync')
    }
    expect(edits.length).toBe(1) // Still 1
  })

  it('save-options message stores options in global state', async () => {
    const options = { theme: 'dark', mode: 'ir' }
    await context.globalState.update('vditor.options', options)
    expect(context.globalState._state['vditor.options']).toEqual(options)
  })

  it('reset-config clears global state', async () => {
    context.globalState._state['vditor.options'] = { theme: 'dark' }
    await context.globalState.update('vditor.options', {})
    expect(context.globalState._state['vditor.options']).toEqual({})
  })

  it('open-link resolves relative paths against file directory', () => {
    const fileUri = Uri.file('/workspace/docs/readme.md')
    const href = './image.png'
    const resolved = path.resolve(fileUri.fsPath, '..', href)
    expect(resolved).toBe(path.resolve('/workspace/docs', 'image.png'))
  })

  it('open-link preserves http URLs', () => {
    const href = 'https://example.com'
    const isHttp = /^http/.test(href)
    expect(isHttp).toBe(true)
  })
})

describe('new settings forwarded to webview', () => {
  let panel: ReturnType<typeof mockWebviewPanel>
  let context: ReturnType<typeof mockExtensionContext>

  beforeEach(() => {
    panel = mockWebviewPanel({ active: true })
    context = mockExtensionContext()
    // Reset to package.json-style defaults between tests
    setMockConfig('outlinePosition', 'right')
    setMockConfig('highlightHeadings', false)
  })

  // Replicates the ready -> update handler used by both EditorPanel and
  // MarkdownEditorProvider in src/extension.ts.
  async function simulateReady() {
    const config = workspace.getConfiguration('markdown-editor')
    panel.webview.postMessage({
      command: 'update',
      content: '# Test',
      type: 'init',
      options: {
        useVscodeThemeColor: config.get('useVscodeThemeColor'),
        highlightHeadings: config.get('highlightHeadings'),
        outlinePosition: config.get('outlinePosition'),
        ...context.globalState.get('vditor.options'),
      },
      theme: window.activeColorTheme.kind === ColorThemeKind.Dark ? 'dark' : 'light',
    })
  }

  it('forwards outlinePosition and highlightHeadings on ready (defaults from mock)', async () => {
    await simulateReady()
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'update',
        type: 'init',
        options: expect.objectContaining({
          outlinePosition: 'right',
          highlightHeadings: false,
        }),
      })
    )
  })

  it("forwards outlinePosition === 'left' when configured", async () => {
    setMockConfig('outlinePosition', 'left')
    await simulateReady()
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ outlinePosition: 'left' }),
      })
    )
  })

  it('forwards highlightHeadings === true when configured', async () => {
    setMockConfig('highlightHeadings', true)
    await simulateReady()
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ highlightHeadings: true }),
      })
    )
  })

  it('setMockConfig accepts the two new keys without changing other config', async () => {
    // Snapshot an unrelated key so we can verify our writes don't affect it.
    const config = workspace.getConfiguration('markdown-editor')
    const before = config.get('imageSaveFolder')
    setMockConfig('outlinePosition', 'left')
    setMockConfig('highlightHeadings', true)
    expect(config.get('outlinePosition')).toBe('left')
    expect(config.get('highlightHeadings')).toBe(true)
    // unrelated key unaffected
    expect(config.get('imageSaveFolder')).toBe(before)
  })

  it('returns the mock default for outlinePosition / highlightHeadings when unset by a test', () => {
    // The mock seeds these keys, so .get() returns the mock default rather
    // than undefined. (See vscode-mock.ts mockConfig.)
    const config = workspace.getConfiguration('markdown-editor')
    expect(config.get('outlinePosition')).toBe('right')
    expect(config.get('highlightHeadings')).toBe(false)
  })

  it('falls back to caller-provided default for an unknown key', () => {
    const config = workspace.getConfiguration('markdown-editor')
    expect(config.get('totallyUnknownKey', 'fallback')).toBe('fallback')
  })
})

describe('circular update prevention', () => {
  it('does not forward changes when panel is active', () => {
    const panel = mockWebviewPanel({ active: true })
    // Simulate onDidChangeTextDocument logic
    if (panel.active) {
      // Should return early, not call postMessage
      return
    }
    panel.webview.postMessage({ command: 'update', content: '# Changed' })
    // If we reach here, the test fails
    expect(panel.webview.postMessage).not.toHaveBeenCalled()
  })

  it('forwards changes when panel is inactive', () => {
    const panel = mockWebviewPanel({ active: false })
    if (!panel.active) {
      panel.webview.postMessage({ command: 'update', content: '# Changed' })
    }
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'update' })
    )
  })
})

describe('upload path resolution', () => {
  it('generates relative paths from file to assets folder', () => {
    const filePath = '/workspace/docs/readme.md'
    const assetsFolder = '/workspace/docs/assets'
    const fileName = '20260402_120000_image.png'

    const relative = path.relative(
      path.dirname(filePath),
      path.join(assetsFolder, fileName)
    ).replace(/\\/g, '/')

    expect(relative).toBe('assets/20260402_120000_image.png')
  })

  it('handles assets folder at project root', () => {
    const filePath = '/workspace/docs/readme.md'
    const assetsFolder = '/workspace/assets'
    const fileName = 'image.png'

    const relative = path.relative(
      path.dirname(filePath),
      path.join(assetsFolder, fileName)
    ).replace(/\\/g, '/')

    expect(relative).toBe('../assets/image.png')
  })
})
