import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  Uri,
  workspace,
  window,
  mockExtensionContext,
  mockWebviewPanel,
} from './vscode-mock'
import { EditorPanel } from '../../src/extension'

// Regression tests for the dispose() audit:
// 1. workspace.onDidCloseTextDocument was being called as
//    (listener, this._disposables) — passing the disposables array
//    in the thisArgs slot, so the listener was never tracked for
//    cleanup. Fix: pass (listener, null, this._disposables).
// 2. workspace.onDidChangeTextDocument had the same bug.
// 3. The debounce timer for onDidChangeTextDocument was a
//    constructor-local `let textEditTimer` — dispose() couldn't
//    reach it, so a pending setTimeout could fire after the panel
//    was disposed and call _update() on a dead webview. Fix:
//    promote to an instance field _textEditTimer and clearTimeout
//    in dispose().

// Helper: spin up an EditorPanel via the real createOrShow factory.
// Returns the constructed panel (also accessible as
// EditorPanel.currentPanel) and the mock WebviewPanel that backs it.
async function makePanel() {
  const context = mockExtensionContext() as any
  const fakeWebview = mockWebviewPanel({ active: false })
  ;(window.createWebviewPanel as any).mockReturnValue(fakeWebview)

  await EditorPanel.createOrShow(context, Uri.file('/test/doc.md'))

  const panel = EditorPanel.currentPanel
  if (!panel) throw new Error('expected EditorPanel.currentPanel to be set')
  return { panel, fakeWebview, context }
}

describe('EditorPanel listener cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (EditorPanel.currentPanel) {
      EditorPanel.currentPanel.dispose()
    }
  })

  afterEach(() => {
    if (EditorPanel.currentPanel) {
      EditorPanel.currentPanel.dispose()
    }
  })

  it('registers onDidCloseTextDocument with the disposables array as the third arg', async () => {
    await makePanel()

    // The VS Code event subscription API is:
    //   onDidCloseTextDocument(listener, thisArgs?, disposables?)
    // We must pass `null` for thisArgs and our _disposables array for
    // disposables. Previously the bug was passing _disposables in the
    // thisArgs slot, which silently leaked the listener.
    expect(workspace.onDidCloseTextDocument).toHaveBeenCalled()
    const args = (workspace.onDidCloseTextDocument as any).mock.calls[0]
    expect(args.length).toBeGreaterThanOrEqual(3)
    expect(typeof args[0]).toBe('function')
    expect(args[1]).toBeNull()
    expect(Array.isArray(args[2])).toBe(true)
  })

  it('registers onDidChangeTextDocument with the disposables array as the third arg', async () => {
    await makePanel()

    expect(workspace.onDidChangeTextDocument).toHaveBeenCalled()
    const args = (workspace.onDidChangeTextDocument as any).mock.calls[0]
    expect(args.length).toBeGreaterThanOrEqual(3)
    expect(typeof args[0]).toBe('function')
    expect(args[1]).toBeNull()
    expect(Array.isArray(args[2])).toBe(true)
  })
})

describe('EditorPanel debounce timer cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (EditorPanel.currentPanel) {
      EditorPanel.currentPanel.dispose()
    }
  })

  afterEach(() => {
    if (EditorPanel.currentPanel) {
      EditorPanel.currentPanel.dispose()
    }
  })

  it('clears the pending text-edit debounce timer on dispose', async () => {
    const { panel } = await makePanel()

    // Plant a fake timer handle on the panel and verify dispose()
    // calls clearTimeout with that handle and resets the field.
    // This is an instance field added in the dispose audit; before
    // the fix the timer was a constructor-local variable that
    // dispose() couldn't reach.
    const fakeHandle = 'FAKE_TIMER_HANDLE' as unknown as NodeJS.Timeout
    ;(panel as any)._textEditTimer = fakeHandle

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    panel.dispose()

    expect(clearTimeoutSpy).toHaveBeenCalledWith(fakeHandle)
    expect((panel as any)._textEditTimer).toBeUndefined()

    clearTimeoutSpy.mockRestore()
  })

  it('queues the text-edit handler such that it sets the instance timer (not a local)', async () => {
    const { panel, fakeWebview } = await makePanel()

    // Grab the change handler the constructor registered.
    const changeHandlerCall = (workspace.onDidChangeTextDocument as any).mock
      .calls[0]
    const changeHandler = changeHandlerCall[0] as (e: any) => void

    // Make the handler proceed past its guards: matching document,
    // panel inactive. (The fake webview was created inactive.)
    expect(fakeWebview.active).toBe(false)

    changeHandler({ document: { fileName: '/test/doc.md' } })

    // After the handler runs, the instance field must hold a timer.
    // This wouldn't be the case if the fix regressed back to a
    // constructor-local `let textEditTimer`.
    expect((panel as any)._textEditTimer).toBeDefined()

    // And calling dispose now should clear it.
    panel.dispose()
    expect((panel as any)._textEditTimer).toBeUndefined()
  })
})
