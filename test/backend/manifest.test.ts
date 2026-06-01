import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const manifest = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
)

describe('package.json: activationEvents', () => {
  it('does NOT activate the extension on every markdown file open', () => {
    // onLanguage:markdown fires when any .md file is opened anywhere
    // in VS Code, even if the user never invokes our editor. Activating
    // unconditionally is a noticeable perf hit for users who keep us
    // installed but use other markdown previewers.
    expect(manifest.activationEvents).not.toContain('onLanguage:markdown')
  })

  it('activates on our command, custom editor, and surviving webview', () => {
    expect(manifest.activationEvents).toContain(
      'onCommand:markdown-editor.openEditor'
    )
    expect(manifest.activationEvents).toContain(
      'onCustomEditor:markdown-editor.customEditor'
    )
    expect(manifest.activationEvents).toContain(
      'onWebviewPanel:markdown-editor'
    )
  })

  it('declares exactly the three intentional activation events', () => {
    // Catches accidental additions — every event here is a cost.
    expect(manifest.activationEvents).toHaveLength(3)
  })
})

describe('package.json: contributed settings', () => {
  const props = manifest.contributes.configuration.properties

  it('declares all ten user-facing settings', () => {
    expect(Object.keys(props).sort()).toEqual([
      'markdown-editor.customCss',
      'markdown-editor.headingHighlightBackground',
      'markdown-editor.headingHighlightForeground',
      'markdown-editor.headingHighlightPerLevel',
      'markdown-editor.highlightHeadings',
      'markdown-editor.highlightTableHeaders',
      'markdown-editor.imageSaveFolder',
      'markdown-editor.outlineMaxDepth',
      'markdown-editor.outlinePosition',
      'markdown-editor.useVscodeThemeColor',
    ])
  })

  it('outlinePosition has the correct enum and default', () => {
    const op = props['markdown-editor.outlinePosition']
    expect(op.type).toBe('string')
    expect(op.enum).toEqual(['left', 'right'])
    expect(op.default).toBe('right')
  })

  it('highlightHeadings defaults to false', () => {
    expect(props['markdown-editor.highlightHeadings'].default).toBe(false)
  })

  it('heading highlight color overrides default to empty string', () => {
    // Empty string is the sentinel for "use the VS Code theme variable
    // fallback" — the CSS rule is `var(--bme-heading-bg, var(--vscode-…))`.
    expect(props['markdown-editor.headingHighlightBackground'].default).toBe('')
    expect(props['markdown-editor.headingHighlightForeground'].default).toBe('')
    expect(props['markdown-editor.headingHighlightBackground'].type).toBe('string')
    expect(props['markdown-editor.headingHighlightForeground'].type).toBe('string')
  })

  it('headingHighlightPerLevel defaults to false', () => {
    expect(props['markdown-editor.headingHighlightPerLevel'].default).toBe(false)
    expect(props['markdown-editor.headingHighlightPerLevel'].type).toBe('boolean')
  })

  it('highlightTableHeaders defaults to false', () => {
    expect(props['markdown-editor.highlightTableHeaders'].default).toBe(false)
    expect(props['markdown-editor.highlightTableHeaders'].type).toBe('boolean')
  })

  it('outlineMaxDepth is a 1..6 integer with default 6', () => {
    const o = props['markdown-editor.outlineMaxDepth']
    expect(o.type).toBe('integer')
    expect(o.minimum).toBe(1)
    expect(o.maximum).toBe(6)
    expect(o.default).toBe(6)
  })

  it('every setting has a description', () => {
    for (const [key, value] of Object.entries(props) as any) {
      expect(value.description, `${key} is missing description`).toBeTruthy()
    }
  })
})
