import * as vscode from "vscode";
import { EditorPanel } from "./extension";

export default class MarkdownEditorProvider
  implements vscode.CustomTextEditorProvider
{
  public static register(context: vscode.ExtensionContext) {
    const provider = new MarkdownEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      EditorPanel.viewType,
      provider
    );
    console.log("provider:", provider, "registration:", providerRegistration);
    return providerRegistration;
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    doc: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ) {
    console.log("Resolving custom editor");
    await EditorPanel.resolve(this.context, doc, panel);
    console.log("Resolved");
  }
}
