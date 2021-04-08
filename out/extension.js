"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const NodePath = require("path");
const KeyVditorOptions = 'vditor.options';
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('markdown-editor.startEditor', () => {
        EditorPanel.createOrShow(context);
    }));
    context.globalState.setKeysForSync([KeyVditorOptions]);
}
exports.activate = activate;
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
    };
}
/**
 * Manages cat coding webview panels
 */
class EditorPanel {
    constructor(_context, _panel, _extensionUri, _document) {
        // Set the webview's initial html content
        this._context = _context;
        this._panel = _panel;
        this._extensionUri = _extensionUri;
        this._document = _document;
        this._disposables = [];
        this._init();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        let textEditTimer;
        vscode.workspace.onDidChangeTextDocument((e) => {
            // 当 webview panel 激活时不将由 webview编辑导致的 vsc 编辑器更新同步回 webview
            if (this._panel.active) {
                return;
            }
            textEditTimer && clearTimeout(textEditTimer);
            textEditTimer = setTimeout(() => {
                this._update();
            }, 500);
        }, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(async (message) => {
            console.log('msg from webview review', message);
            switch (message.command) {
                case 'ready':
                    this._update({
                        options: this._context.globalState.get(KeyVditorOptions)
                    });
                    break;
                case 'save-options':
                    this._context.globalState.update(KeyVditorOptions, message.options);
                    break;
                case 'info':
                    vscode.window.showInformationMessage(message.content);
                    break;
                case 'edit': {
                    // 只有当 webview 处于编辑状态时才同步到 vsc 编辑器，避免重复刷新
                    if (this._panel.active) {
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(this._document.uri, new vscode.Range(0, 0, this._document.lineCount, 0), message.content);
                        await vscode.workspace.applyEdit(edit);
                    }
                    break;
                }
                case 'save': {
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(this._document.uri, new vscode.Range(0, 0, this._document.lineCount, 0), message.content);
                    await vscode.workspace.applyEdit(edit);
                    await this._document.save();
                    break;
                }
                case 'upload': {
                    const assetsFolder = NodePath.join(NodePath.dirname(this._document.fileName), 'assets');
                    await Promise.all(message.files.map(async (finfo) => {
                        const f = Buffer.from(finfo.base64, 'base64');
                        return vscode.workspace.fs.writeFile(vscode.Uri.file(NodePath.join(assetsFolder, finfo.name)), f);
                    }));
                    const files = message.files.map((f) => `./assets/${f.name}`);
                    this._panel.webview.postMessage({
                        command: 'uploaded',
                        files,
                    });
                    break;
                }
            }
        }, null, this._disposables);
    }
    static createOrShow(context) {
        const { extensionUri } = context;
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it.
        if (EditorPanel.currentPanel) {
            EditorPanel.currentPanel._panel.reveal(column);
            return;
        }
        if (!vscode.window.activeTextEditor) {
            vscode.window.showErrorMessage(`Did not open markdown file!`);
            return;
        }
        const doc = vscode.window.activeTextEditor.document;
        if (doc.languageId !== 'markdown') {
            vscode.window.showErrorMessage(`Current file language is not markdown, got ${doc.languageId}`);
            return;
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(EditorPanel.viewType, 'markdown-editor', column || vscode.ViewColumn.One, getWebviewOptions(extensionUri));
        EditorPanel.currentPanel = new EditorPanel(context, panel, extensionUri, doc);
    }
    dispose() {
        EditorPanel.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _init() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
        this._panel.title = NodePath.basename(this._document.fileName);
    }
    // private fileToWebviewUri = (f: string) => {
    //   return this._panel.webview.asWebviewUri(vscode.Uri.file(f)).toString()
    // }
    _update({ options } = { options: void 0 }) {
        let md = this._document.getText();
        // const dir = NodePath.dirname(this._document.fileName)
        this._panel.webview.postMessage({
            command: 'update',
            content: md,
            options,
        });
    }
    _getHtmlForWebview(webview) {
        const toUri = (f) => webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, f));
        const baseHref = NodePath.dirname(webview.asWebviewUri(this._document.uri).toString()) +
            '/';
        const JsFiles = ['media/vditor/index.min.js', 'media/cash.min.js', 'media/main.js'].map(toUri);
        const CssFiles = ['media/vditor/index.css', 'media/main.css'].map(toUri);
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
			</html>`;
    }
}
EditorPanel.viewType = 'markdown-editor';
//# sourceMappingURL=extension.js.map