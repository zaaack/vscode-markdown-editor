import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

// ── 1. package.json manifest ─────────────────────────────────────────────────

describe('package.json manifest', () => {
  it('main points to out/extension.js', () => {
    assert.equal(pkg.main, 'out/extension.js')
  })

  it('customEditors has correct viewType', () => {
    const editors = pkg.contributes?.customEditors
    assert.ok(Array.isArray(editors), 'customEditors should be an array')
    const editor = editors.find((e) => e.viewType === 'markdown-editor.customEditor')
    assert.ok(editor, 'should have markdown-editor.customEditor viewType')
  })

  it('customEditors has correct selector for .md and .markdown', () => {
    const editor = pkg.contributes.customEditors.find(
      (e) => e.viewType === 'markdown-editor.customEditor'
    )
    const patterns = editor.selector.map((s) => s.filenamePattern)
    assert.ok(patterns.includes('*.md'), 'should match *.md')
    assert.ok(patterns.includes('*.markdown'), 'should match *.markdown')
  })

  it('customEditors priority is "option"', () => {
    const editor = pkg.contributes.customEditors.find(
      (e) => e.viewType === 'markdown-editor.customEditor'
    )
    assert.equal(editor.priority, 'option')
  })

  it('commands includes markdown-editor.openEditor', () => {
    const commands = pkg.contributes?.commands
    assert.ok(Array.isArray(commands), 'commands should be an array')
    const cmd = commands.find((c) => c.command === 'markdown-editor.openEditor')
    assert.ok(cmd, 'should have markdown-editor.openEditor command')
  })

  it('engines.vscode is a valid semver range', () => {
    const engine = pkg.engines?.vscode
    assert.ok(engine, 'engines.vscode should exist')
    assert.match(engine, /^\^?\d+\.\d+\.\d+$/, 'should be a valid semver range')
  })
})

// ── 2. Build output (out/extension.js) ───────────────────────────────────────

describe('build output (out/extension.js)', () => {
  const outFile = join(ROOT, 'out', 'extension.js')

  it('out/extension.js exists', () => {
    assert.ok(existsSync(outFile), 'out/extension.js should exist')
  })

  it('is valid JavaScript syntax', () => {
    const code = readFileSync(outFile, 'utf8')
    // This will throw SyntaxError if invalid
    new Function(code)
  })

  it('exports activate function', () => {
    const code = readFileSync(outFile, 'utf8')
    // Check for multiple possible export patterns:
    // tsc:    exports.activate = activate;   OR   exports.activate = void 0; ... exports.activate = activate;
    // esbuild: module.exports = { activate }  OR  exports.activate = ...
    const hasExport =
      code.includes('exports.activate') ||
      code.includes('module.exports') ||
      // esbuild var-style exports
      /activate.*=.*function/.test(code)
    assert.ok(hasExport, 'should export activate function')
  })

  it('does NOT bundle the vscode module (kept as external require)', () => {
    const code = readFileSync(outFile, 'utf8')
    // Must require vscode as external — should NOT inline vscode source
    assert.ok(
      code.includes('require("vscode")') || code.includes("require('vscode')"),
      'should have require("vscode") as external dependency'
    )
    // Should NOT contain vscode internals (e.g. ExtensionKind enum definition)
    assert.ok(
      !code.includes('class ExtensionKind'),
      'should NOT bundle vscode internals'
    )
  })

  it('file size is under 50KB (single bundled file should be small)', () => {
    const stats = statSync(outFile)
    assert.ok(
      stats.size < 50 * 1024,
      `out/extension.js is ${(stats.size / 1024).toFixed(1)}KB, should be < 50KB`
    )
  })

  it('is CommonJS format (not ESM)', () => {
    const code = readFileSync(outFile, 'utf8')
    // CommonJS indicators
    const isCJS =
      code.includes('exports.') ||
      code.includes('module.exports') ||
      code.includes('require(')
    assert.ok(isCJS, 'should be CommonJS format')
  })
})

// ── 3. Webview assets untouched ──────────────────────────────────────────────

describe('webview assets untouched', () => {
  it('media/dist/main.js exists and is > 100KB', () => {
    const f = join(ROOT, 'media', 'dist', 'main.js')
    assert.ok(existsSync(f), 'media/dist/main.js should exist')
    const stats = statSync(f)
    assert.ok(
      stats.size > 100 * 1024,
      `media/dist/main.js is ${(stats.size / 1024).toFixed(1)}KB, should be > 100KB`
    )
  })

  it('media/dist/main.css exists and is > 10KB', () => {
    const f = join(ROOT, 'media', 'dist', 'main.css')
    assert.ok(existsSync(f), 'media/dist/main.css should exist')
    const stats = statSync(f)
    assert.ok(
      stats.size > 10 * 1024,
      `media/dist/main.css is ${(stats.size / 1024).toFixed(1)}KB, should be > 10KB`
    )
  })
})

// ── 4. Build system ──────────────────────────────────────────────────────────

describe('build system', () => {
  it('extension build command exits 0 and produces out/extension.js', () => {
    // Determine which build command to use based on what's available
    const hasBuildExt = pkg.scripts?.['build:ext']
    const buildCmd = hasBuildExt ? 'pnpm run build:ext' : 'pnpm exec tsc -p ./'

    execSync(buildCmd, { cwd: ROOT, stdio: 'pipe' })

    assert.ok(
      existsSync(join(ROOT, 'out', 'extension.js')),
      'out/extension.js should exist after build'
    )
  })
})
