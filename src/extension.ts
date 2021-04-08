import * as vscode from 'vscode'
import * as NodePath from 'path'
const KeyVditorOptions = 'vditor.options'
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'markdown-editor.openEditor',
      (uri?: vscode.Uri, ...args) => {
        console.log('command', uri, args)
        EditorPanel.createOrShow(context, uri)
      }
    )
  )
  context.globalState.setKeysForSync([KeyVditorOptions])
}

function getWebviewOptions(
  extensionUri: vscode.Uri
): vscode.WebviewOptions & vscode.WebviewPanelOptions {
  return {
    // Enable javascript in the webview
    enableScripts: true,

    retainContextWhenHidden: true,
  }
}

/**
 * Manages cat coding webview panels
 */
class EditorPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: EditorPanel | undefined

  public static readonly viewType = 'markdown-editor'

  private _disposables: vscode.Disposable[] = []

  public static createOrShow(
    context: vscode.ExtensionContext,
    uri?: vscode.Uri
  ) {
    const { extensionUri } = context
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined
    if (uri && EditorPanel.currentPanel) {
      EditorPanel.currentPanel.dispose()
    }
    // If we already have a panel, show it.
    if (EditorPanel.currentPanel) {
      EditorPanel.currentPanel._panel.reveal(column)
      return
    }
    if (!vscode.window.activeTextEditor && !uri) {
      vscode.window.showErrorMessage(`Did not open markdown file!`)
      return
    }
    let doc = uri ? void 0 : vscode.window.activeTextEditor?.document
    // 从当前打开的 textEditor 中寻找 是否有当前 markdown 的 editor, 有的话则绑定 document
    if (!doc || doc.languageId !== 'markdown') {
      console.log('visibleDocs', vscode.workspace.textDocuments.map(e => e.fileName))
      vscode.workspace.textDocuments.forEach((d) => {
        if (d.fileName === uri?.fsPath) {
          doc = d
        }
      })
    }
    if (doc && doc.languageId !== 'markdown') {
      vscode.window.showErrorMessage(
        `Current file language is not markdown, got ${doc.languageId}`
      )
      return
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      EditorPanel.viewType,
      'markdown-editor',
      column || vscode.ViewColumn.One,
      getWebviewOptions(extensionUri)
    )

    EditorPanel.currentPanel = new EditorPanel(
      context,
      panel,
      extensionUri,
      doc,
      uri
    )
  }

  private get _fsPath() {
    return (this._document?.uri ?? this._uri!).fsPath
  }

  private constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    public _document?: vscode.TextDocument, // 当前有 markdown 编辑器
    public _uri = _document?.uri // 从资源管理器打开，只有 uri 没有 _document
  ) {
    // Set the webview's initial html content

    this._init()

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
    let textEditTimer: NodeJS.Timeout | void
    // 有文件打开时更新 _document
    vscode.workspace.onDidOpenTextDocument((e) => {
      if (e.fileName === this._fsPath) {
        this._document = e
      }
    }, this._disposables)
    vscode.workspace.onDidCloseTextDocument((e) => {
      if (e.fileName === this._fsPath) {
        this._document = void 0
      }
    }, this._disposables)
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.fileName !== this._document?.fileName) {
        return
      }
      // 当 webview panel 激活时不将由 webview编辑导致的 vsc 编辑器更新同步回 webview
      if (this._panel.active) {
        return
      }
      textEditTimer && clearTimeout(textEditTimer)
      textEditTimer = setTimeout(() => {
        this._update()
      }, 500)
    }, this._disposables)
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log('msg from webview review', message)

        const syncToEditor = async () => {
          if (this._document) {
            const edit = new vscode.WorkspaceEdit()
            edit.replace(
              this._document.uri,
              new vscode.Range(0, 0, this._document.lineCount, 0),
              message.content
            )
            await vscode.workspace.applyEdit(edit)
          } else if (this._uri) {
            await vscode.workspace.fs.writeFile(this._uri, message.content)
          } else {
            vscode.window.showErrorMessage(`Cannot find original file to save!`)
          }
        }
        switch (message.command) {
          case 'ready':
            this._update({
              options: this._context.globalState.get(KeyVditorOptions),
            })
            break
          case 'save-options':
            this._context.globalState.update(KeyVditorOptions, message.options)
            break
          case 'info':
            vscode.window.showInformationMessage(message.content)
            break
          case 'edit': {
            // 只有当 webview 处于编辑状态时才同步到 vsc 编辑器，避免重复刷新
            if (this._panel.active) {
              await syncToEditor()
            }
            break
          }
          case 'save': {
            await syncToEditor()
            await this._document?.save()
            vscode.window.showInformationMessage(`${NodePath.basename(this._fsPath)} saved!`)
            break
          }
          case 'upload': {
            const assetsFolder = NodePath.join(
              NodePath.dirname(this._fsPath),
              'assets'
            )
            await Promise.all(
              message.files.map(async (finfo: any) => {
                const f = Buffer.from(finfo.base64, 'base64')
                return vscode.workspace.fs.writeFile(
                  vscode.Uri.file(NodePath.join(assetsFolder, finfo.name)),
                  f
                )
              })
            )
            const files = message.files.map((f: any) => `./assets/${f.name}`)
            this._panel.webview.postMessage({
              command: 'uploaded',
              files,
            })
            break
          }
        }
      },
      null,
      this._disposables
    )
  }

  public dispose() {
    EditorPanel.currentPanel = undefined

    // Clean up our resources
    this._panel.dispose()

    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }

  private _init() {
    const webview = this._panel.webview

    this._panel.webview.html = this._getHtmlForWebview(webview)
    this._panel.title = NodePath.basename(this._fsPath)
  }

  // private fileToWebviewUri = (f: string) => {
  //   return this._panel.webview.asWebviewUri(vscode.Uri.file(f)).toString()
  // }

  private async _update({ options } = { options: void 0 }) {
    let md = this._document
      ? this._document.getText()
      : (await vscode.workspace.fs.readFile(this._uri!)).toString()
    // const dir = NodePath.dirname(this._document.fileName)
    this._panel.webview.postMessage({
      command: 'update',
      content: md,
      options,
    })
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const toUri = (f: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, f))
    const baseHref =
      NodePath.dirname(
        webview.asWebviewUri(vscode.Uri.file(this._fsPath)).toString()
      ) + '/'
    const JsFiles = [
      'media/vditor/index.min.js',
      'media/cash.min.js',
      'media/main.js',
    ].map(toUri)
    const CssFiles = ['media/vditor/index.css', 'media/main.css'].map(toUri)

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<base href="${baseHref}" />
				${CssFiles.map((f) => `<link href="${f}" rel="stylesheet">`).join('\n')}

				<title>Cat Coding</title>
			</head>
			<body>
				<div id="vditor"></div>
				${JsFiles.map((f) => `<script src="${f}"></script>`).join('\n')}
			</body>
			</html>`
  }
}
