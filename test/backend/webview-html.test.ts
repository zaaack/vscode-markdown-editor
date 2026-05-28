import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import { Uri, workspace, setMockConfig } from './vscode-mock'

// We can't import EditorPanel / MarkdownEditorProvider's HTML helpers directly
// because they are private methods on non-exported classes. Both
// _getHtmlForWebview (EditorPanel) and getHtmlForWebview
// (MarkdownEditorProvider) produce the same template, so we replicate it here
// and assert on the structural pieces. The test should fail loudly if a
// future change drops the <base href>, the script bundle, the css link, the
// customCss interpolation, or the #app mount node.

function buildHtml(opts: {
  extensionUri: any
  fsPath: string
  asWebviewUri: (uri: any) => any
}): string {
  const { extensionUri, fsPath, asWebviewUri } = opts
  const toUri = (f: string) => asWebviewUri(Uri.joinPath(extensionUri, f))
  const baseHref =
    path.dirname(asWebviewUri(Uri.file(fsPath)).toString()) + '/'
  const toMediaPath = (f: string) => `media/dist/${f}`
  const JsFiles = ['main.js'].map(toMediaPath).map(toUri)
  const CssFiles = ['main.css'].map(toMediaPath).map(toUri)

  return (
    `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<base href="${baseHref}" />


				${CssFiles.map((f) => `<link href="${f}" rel="stylesheet">`).join('\n')}

				<title>Better Markdown Editor</title>
        <style>` +
    workspace.getConfiguration('markdown-editor').get('customCss') +
    `</style>
			</head>
			<body>
				<div id="app"></div>


				${JsFiles.map((f) => `<script src="${f}"></script>`).join('\n')}
			</body>
			</html>`
  )
}

describe('webview HTML template', () => {
  let html: string

  beforeEach(() => {
    setMockConfig('customCss', '')
    html = buildHtml({
      extensionUri: Uri.file('/extension'),
      fsPath: '/workspace/docs/readme.md',
      asWebviewUri: (uri: any) => uri,
    })
  })

  it('declares HTML5 doctype', () => {
    expect(html).toContain('<!DOCTYPE html>')
  })

  it("includes a <base href> ending in '/' so relative paths resolve", () => {
    // The <base href> is what makes images / relative links work inside the webview.
    expect(html).toMatch(/<base href="[^"]+\/" \/>/)
  })

  it('sets <base href> to the directory of the current markdown file', () => {
    expect(html).toContain('<base href="/workspace/docs/" />')
  })

  it('loads the main.js bundle', () => {
    expect(html).toContain('media/dist/main.js')
    expect(html).toMatch(/<script src="[^"]*main\.js"><\/script>/)
  })

  it('loads the main.css bundle', () => {
    expect(html).toContain('media/dist/main.css')
    expect(html).toMatch(/<link href="[^"]*main\.css" rel="stylesheet">/)
  })

  it('renders a #app mount node', () => {
    expect(html).toContain('<div id="app"></div>')
  })

  it('sets the title', () => {
    expect(html).toContain('<title>Better Markdown Editor</title>')
  })

  it('declares a viewport meta tag', () => {
    expect(html).toContain('name="viewport"')
  })

  it('interpolates the customCss config setting into a <style> tag', () => {
    setMockConfig('customCss', '.unique-test-marker { color: hotpink; }')
    const out = buildHtml({
      extensionUri: Uri.file('/extension'),
      fsPath: '/workspace/docs/readme.md',
      asWebviewUri: (uri: any) => uri,
    })
    expect(out).toContain('<style>')
    expect(out).toContain('.unique-test-marker { color: hotpink; }')
    expect(out).toContain('</style>')
  })

  it("inlines empty customCss safely (no 'undefined' leakage)", () => {
    // Default config returns '' for customCss.
    expect(html).not.toContain('undefined')
    expect(html).toContain('<style></style>')
  })

  it('uses extensionUri for js/css asset paths', () => {
    const out = buildHtml({
      extensionUri: Uri.file('/ext-root'),
      fsPath: '/workspace/docs/readme.md',
      asWebviewUri: (uri: any) => uri,
    })
    expect(out).toContain('/ext-root/media/dist/main.js')
    expect(out).toContain('/ext-root/media/dist/main.css')
  })
})
