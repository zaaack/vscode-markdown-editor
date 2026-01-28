import * as vscode from 'vscode'
import * as NodePath from 'path'
const KeyVditorOptions = 'vditor.options'

function debug(...args: any[]) {
  console.log(...args)
}

function showError(msg: string) {
  vscode.window.showErrorMessage(`[markdown-editor] ${msg}`)
}

export function activate(context: vscode.ExtensionContext) {
  // Register original command (used by context menu/shortcuts)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'markdown-editor.openEditor',
      (uri?: vscode.Uri, ...args) => {
        debug('command', uri, args)
        EditorPanel.createOrShow(context, uri)
      }
    )
  )

  // Register CustomTextEditorProvider (for "Open With" and default editor)
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      MarkdownEditorProvider.viewType,
      new MarkdownEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  )

  context.globalState.setKeysForSync([KeyVditorOptions])
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

  public static async createOrShow(
    context: vscode.ExtensionContext,
    uri?: vscode.Uri
  ) {
    const { extensionUri } = context
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined
    if (EditorPanel.currentPanel && uri !== EditorPanel.currentPanel?._uri) {
      EditorPanel.currentPanel.dispose()
    }
    // If we already have a panel, show it.
    if (EditorPanel.currentPanel) {
      EditorPanel.currentPanel._panel.reveal(column)
      return
    }
    if (!vscode.window.activeTextEditor && !uri) {
      showError(`Did not open markdown file!`)
      return
    }
    let doc: undefined | vscode.TextDocument
    // From context menu: Find if there is a markdown editor for the current active TextEditor, if so bind the document
    if (uri) {
      // Open file from context menu: Open document first then enable auto-sync, otherwise cannot save file or sync to opened document
      doc = await vscode.workspace.openTextDocument(uri)
    } else {
      doc = vscode.window.activeTextEditor?.document
      // from command mode
      if (doc && doc.languageId !== 'markdown') {
        showError(
          `Current file language is not markdown, got ${doc.languageId}`
        )
        return
      }
    }

    if (!doc) {
      showError(`Cannot find markdown file!`)
      return
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      EditorPanel.viewType,
      'markdown-editor',
      column || vscode.ViewColumn.One,
      EditorPanel.getWebviewOptions(uri)
    )

    EditorPanel.currentPanel = new EditorPanel(
      context,
      panel,
      extensionUri,
      doc,
      uri
    )
  }

  private static getFolders(): vscode.Uri[] {
    const data = []
    for (let i = 65; i <= 90; i++) {
      data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`))
    }
    return data
  }

  static getWebviewOptions(
    uri?: vscode.Uri
  ): vscode.WebviewOptions & vscode.WebviewPanelOptions {
    return {
      // Enable javascript in the webview
      enableScripts: true,

      localResourceRoots: [vscode.Uri.file("/"), ...this.getFolders()],
      retainContextWhenHidden: true,
      enableCommandUris: true,
    }
  }
  private get _fsPath() {
    return this._uri.fsPath
  }

  static get config() {
    return vscode.workspace.getConfiguration('markdown-editor')
  }

  private constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    public _document: vscode.TextDocument,
    public _uri = _document.uri // Opened from explorer, only uri exists, no _document
  ) {
    // Set the webview's initial html content

    this._init()

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
    let textEditTimer: NodeJS.Timeout | void
    // close EditorPanel when vsc editor is close
    vscode.workspace.onDidCloseTextDocument((e) => {
      if (e.fileName === this._fsPath) {
        this.dispose()
      }
    }, this._disposables)
    // re-init webview when VS Code theme changes
    vscode.window.onDidChangeActiveColorTheme((theme) => {
      this._update({
        type: 'init',
        options: {
          useVscodeThemeColor: EditorPanel.config.get<boolean>(
            'useVscodeThemeColor'
          ),
          ...this._context.globalState.get(KeyVditorOptions),
        },
        theme: theme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light',
      })
    }, null, this._disposables)
    // update EditorPanel when vsc editor changes
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.fileName !== this._document.fileName) {
        return
      }
      // When webview panel is active, do not sync updates from VS Code editor caused by webview edits back to webview
      // don't change webview panel when webview panel is focus
      if (this._panel.active) {
        return
      }
      textEditTimer && clearTimeout(textEditTimer)
      textEditTimer = setTimeout(() => {
        this._update()
        this._updateEditTitle()
      }, 300)
    }, this._disposables)
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        debug('msg from webview review', message, this._panel.active)

        const syncToEditor = async () => {
          debug('sync to editor', this._document, this._uri)
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
            showError(`Cannot find original file to save!`)
          }
        }
        switch (message.command) {
          case 'ready':
            this._update({
              type: 'init',
              options: {
                useVscodeThemeColor: EditorPanel.config.get<boolean>(
                  'useVscodeThemeColor'
                ),
                ...this._context.globalState.get(KeyVditorOptions),
              },
              theme:
                vscode.window.activeColorTheme.kind ===
                  vscode.ColorThemeKind.Dark
                  ? 'dark'
                  : 'light',
            })
            break
          case 'save-options':
            this._context.globalState.update(KeyVditorOptions, message.options)
            break
          case 'info':
            vscode.window.showInformationMessage(message.content)
            break
          case 'error':
            showError(message.content)
            break
          case 'edit': {
            // Only sync to VS Code editor when webview is in edit mode to avoid repeated refresh
            if (this._panel.active) {
              await syncToEditor()
              this._updateEditTitle()
            }
            break
          }
          case 'reset-config': {
            await this._context.globalState.update(KeyVditorOptions, {})
            break
          }
          case 'save': {
            await syncToEditor()
            await this._document.save()
            this._updateEditTitle()
            break
          }
          case 'upload': {
            const assetsFolder = EditorPanel.getAssetsFolder(this._uri)
            try {
              await vscode.workspace.fs.createDirectory(
                vscode.Uri.file(assetsFolder)
              )
            } catch (error) {
              console.error(error)
              showError(`Invalid image folder: ${assetsFolder}`)
            }
            await Promise.all(
              message.files.map(async (f: any) => {
                const content = Buffer.from(f.base64, 'base64')
                return vscode.workspace.fs.writeFile(
                  vscode.Uri.file(NodePath.join(assetsFolder, f.name)),
                  content
                )
              })
            )
            const files = message.files.map((f: any) =>
              NodePath.relative(
                NodePath.dirname(this._fsPath),
                NodePath.join(assetsFolder, f.name)
              ).replace(/\\/g, '/')
            )
            this._panel.webview.postMessage({
              command: 'uploaded',
              files,
            })
            break
          }
          case 'open-link': {
            let url = message.href
            if (!/^http/.test(url)) {
              url = NodePath.resolve(this._fsPath, '..', url)
            }
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url))
            break
          }
        }
      },
      null,
      this._disposables
    )
  }

  static getAssetsFolder(uri: vscode.Uri) {
    const imageSaveFolder = (
      EditorPanel.config.get<string>('imageSaveFolder') || 'assets'
    )
      .replace(
        '${projectRoot}',
        vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath || ''
      )
      .replace('${file}', uri.fsPath)
      .replace(
        '${fileBasenameNoExtension}',
        NodePath.basename(uri.fsPath, NodePath.extname(uri.fsPath))
      )
      .replace('${dir}', NodePath.dirname(uri.fsPath))
    const assetsFolder = NodePath.resolve(
      NodePath.dirname(uri.fsPath),
      imageSaveFolder
    )
    return assetsFolder
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
  private _isEdit = false
  private _updateEditTitle() {
    const isEdit = this._document.isDirty
    if (isEdit !== this._isEdit) {
      this._isEdit = isEdit
      this._panel.title = `${isEdit ? `[edit]` : ''}${NodePath.basename(
        this._fsPath
      )}`
    }
  }

  // private fileToWebviewUri = (f: string) => {
  //   return this._panel.webview.asWebviewUri(vscode.Uri.file(f)).toString()
  // }

  private async _update(
    props: {
      type?: 'init' | 'update'
      options?: any
      theme?: 'dark' | 'light'
    } = { options: void 0 }
  ) {
    const md = this._document
      ? this._document.getText()
      : (await vscode.workspace.fs.readFile(this._uri)).toString()
    // const dir = NodePath.dirname(this._document.fileName)
    this._panel.webview.postMessage({
      command: 'update',
      content: md,
      ...props,
    })
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const toUri = (f: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, f))
    const baseHref =
      NodePath.dirname(
        webview.asWebviewUri(vscode.Uri.file(this._fsPath)).toString()
      ) + '/'
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

				<title>markdown editor</title>
        <style>` +
      EditorPanel.config.get<string>('customCss') +
      `</style>
			</head>
			<body>
				<div id="app"></div>


				${JsFiles.map((f) => `<script src="${f}"></script>`).join('\n')}
			</body>
			</html>`
    )
  }
}

/**
 * MarkdownEditorProvider implements CustomTextEditorProvider interface
 * Supports opening markdown files via "Open With"
 */
class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'markdown-editor.customEditor'

  constructor(private readonly context: vscode.ExtensionContext) { }

  /**
   * Called when user selects Markdown Editor via "Open With"
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Set webview options
    webviewPanel.webview.options = this.getWebviewOptions()

    // Init webview content
    const uri = document.uri
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, uri)
    webviewPanel.title = NodePath.basename(uri.fsPath)

    const disposables: vscode.Disposable[] = []
    let isEditing = false

    // Update title to show edit status
    const updateEditTitle = () => {
      const isDirty = document.isDirty
      if (isDirty !== isEditing) {
        isEditing = isDirty
        webviewPanel.title = `${isDirty ? '[edit]' : ''}${NodePath.basename(uri.fsPath)}`
      }
    }

    // Send update to webview
    const updateWebview = (props: { type?: 'init' | 'update'; options?: any; theme?: 'dark' | 'light' } = {}) => {
      webviewPanel.webview.postMessage({
        command: 'update',
        content: document.getText(),
        ...props,
      })
    }

    // Listen for document close
    vscode.workspace.onDidCloseTextDocument((e) => {
      if (e.fileName === uri.fsPath) {
        webviewPanel.dispose()
      }
    }, null, disposables)

    // Listen for document changes (sync from external editor to webview)
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.fileName !== document.fileName) {
        return
      }
      // Do not sync when webview panel is active (avoid circular updates)
      if (webviewPanel.active) {
        return
      }
      updateWebview()
      updateEditTitle()
    }, null, disposables)

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      debug('msg from webview', message, webviewPanel.active)

      const syncToEditor = async () => {
        const edit = new vscode.WorkspaceEdit()
        edit.replace(
          document.uri,
          new vscode.Range(0, 0, document.lineCount, 0),
          message.content
        )
        await vscode.workspace.applyEdit(edit)
      }

      switch (message.command) {
        case 'ready':
          updateWebview({
            type: 'init',
            options: {
              useVscodeThemeColor: EditorPanel.config.get<boolean>('useVscodeThemeColor'),
              ...this.context.globalState.get(KeyVditorOptions),
            },
            theme: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light',
          })
          break
        case 'save-options':
          this.context.globalState.update(KeyVditorOptions, message.options)
          break
        case 'info':
          vscode.window.showInformationMessage(message.content)
          break
        case 'error':
          showError(message.content)
          break
        case 'edit':
          if (webviewPanel.active) {
            await syncToEditor()
            updateEditTitle()
          }
          break
        case 'reset-config':
          await this.context.globalState.update(KeyVditorOptions, {})
          break
        case 'save':
          await syncToEditor()
          await document.save()
          updateEditTitle()
          break
        case 'upload': {
          const assetsFolder = EditorPanel.getAssetsFolder(uri)
          try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(assetsFolder))
          } catch (error) {
            console.error(error)
            showError(`Invalid image folder: ${assetsFolder}`)
          }
          await Promise.all(
            message.files.map(async (f: any) => {
              const content = Buffer.from(f.base64, 'base64')
              return vscode.workspace.fs.writeFile(
                vscode.Uri.file(NodePath.join(assetsFolder, f.name)),
                content
              )
            })
          )
          const files = message.files.map((f: any) =>
            NodePath.relative(NodePath.dirname(uri.fsPath), NodePath.join(assetsFolder, f.name)).replace(/\\/g, '/')
          )
          webviewPanel.webview.postMessage({
            command: 'uploaded',
            files,
          })
          break
        }
        case 'open-link': {
          let url = message.href
          if (!/^http/.test(url)) {
            url = NodePath.resolve(uri.fsPath, '..', url)
          }
          vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url))
          break
        }
      }
    }, null, disposables)

    // Clean up resources
    webviewPanel.onDidDispose(() => {
      disposables.forEach((d) => d.dispose())
    })
  }

  private static getFolders(): vscode.Uri[] {
    const data = []
    for (let i = 65; i <= 90; i++) {
      data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`))
    }
    return data
  }

  private getWebviewOptions(): vscode.WebviewOptions {
    return {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file('/'), ...MarkdownEditorProvider.getFolders()],
    }
  }

  private getHtmlForWebview(webview: vscode.Webview, uri: vscode.Uri): string {
    const toUri = (f: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, f))
    const baseHref = NodePath.dirname(webview.asWebviewUri(vscode.Uri.file(uri.fsPath)).toString()) + '/'
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

				<title>markdown editor</title>
        <style>` +
      EditorPanel.config.get<string>('customCss') +
      `</style>
			</head>
			<body>
				<div id="app"></div>


				${JsFiles.map((f) => `<script src="${f}"></script>`).join('\n')}
			</body>
			</html>`
    )
  }
}
