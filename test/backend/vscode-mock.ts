import { vi } from 'vitest'
import * as path from 'path'

class MockUri {
  constructor(public fsPath: string) {}
  static file(p: string) { return new MockUri(p) }
  static parse(s: string) { return new MockUri(s) }
  static joinPath(base: MockUri, ...segments: string[]) {
    return new MockUri(path.join(base.fsPath, ...segments))
  }
  toString() { return this.fsPath }
}

class MockRange {
  constructor(
    public startLine: number,
    public startChar: number,
    public endLine: number,
    public endChar: number
  ) {}
}

class MockWorkspaceEdit {
  edits: Array<{ uri: MockUri; range: MockRange; content: string }> = []
  replace(uri: MockUri, range: MockRange, content: string) {
    this.edits.push({ uri, range, content })
  }
}

export const Uri = MockUri
export const Range = MockRange
export const WorkspaceEdit = MockWorkspaceEdit

export enum ViewColumn { One = 1, Two = 2, Three = 3 }
export enum ColorThemeKind { Light = 1, Dark = 2, HighContrast = 3 }

const mockConfig: Record<string, any> = {
  imageSaveFolder: 'assets',
  useVscodeThemeColor: true,
  customCss: '',
  outlinePosition: 'right',
  highlightHeadings: false,
  headingHighlightBackground: '',
  headingHighlightForeground: '',
  headingHighlightPerLevel: false,
}

export const workspace = {
  getConfiguration: vi.fn((section?: string) => ({
    get: vi.fn((key: string, defaultValue?: any) => mockConfig[key] ?? defaultValue),
  })),
  getWorkspaceFolder: vi.fn((uri: MockUri) => ({
    uri: new MockUri('/workspace'),
  })),
  applyEdit: vi.fn(async () => true),
  openTextDocument: vi.fn(async (uri: MockUri) => ({
    uri,
    fileName: uri.fsPath,
    getText: () => '# Test',
    lineCount: 1,
    languageId: 'markdown',
    isDirty: false,
    save: vi.fn(async () => true),
  })),
  fs: {
    readFile: vi.fn(async () => Buffer.from('# Test')),
    writeFile: vi.fn(async () => {}),
    createDirectory: vi.fn(async () => {}),
  },
  onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
}

export const window = {
  activeTextEditor: undefined as any,
  activeColorTheme: { kind: ColorThemeKind.Dark },
  createWebviewPanel: vi.fn(() => mockWebviewPanel()),
  registerCustomEditorProvider: vi.fn(() => ({ dispose: vi.fn() })),
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  onDidChangeActiveColorTheme: vi.fn(() => ({ dispose: vi.fn() })),
}

export const commands = {
  registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  executeCommand: vi.fn(),
}

export function mockWebviewPanel(options?: { active?: boolean }) {
  const messageHandlers: Function[] = []
  return {
    active: options?.active ?? true,
    webview: {
      html: '',
      options: {},
      postMessage: vi.fn(async () => true),
      onDidReceiveMessage: vi.fn((handler: Function) => {
        messageHandlers.push(handler)
        return { dispose: vi.fn() }
      }),
      asWebviewUri: vi.fn((uri: MockUri) => uri),
      _messageHandlers: messageHandlers,
    },
    reveal: vi.fn(),
    dispose: vi.fn(),
    onDidDispose: vi.fn((cb: Function) => ({ dispose: vi.fn() })),
    title: '',
    viewColumn: ViewColumn.One,
  }
}

export function mockExtensionContext() {
  const state: Record<string, any> = {}
  return {
    extensionUri: new MockUri('/extension'),
    globalState: {
      get: vi.fn((key: string) => state[key]),
      update: vi.fn(async (key: string, value: any) => { state[key] = value }),
      setKeysForSync: vi.fn(),
      _state: state,
    },
    subscriptions: [] as any[],
  }
}

export function setMockConfig(key: string, value: any) {
  mockConfig[key] = value
}
