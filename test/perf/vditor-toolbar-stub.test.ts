import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const repoRoot = path.resolve(__dirname, '../..')
const bundlePath = path.join(repoRoot, 'media/dist/main.js')
const stubPath = path.join(
  repoRoot,
  'media-src/src/stubs/vditor-toolbar-stubs.ts'
)
const buildScriptPath = path.join(repoRoot, 'media-src/build.mjs')

// These regression tests prove the esbuild stub-plugin actually kept the
// four unused Vditor toolbar button modules out of the shipped bundle.
// Each canary string below is taken directly from the real Vditor source
// file we replaced — if any string reappears in `media/dist/main.js`, it
// means the stub plugin's filter regex stopped matching the real path and
// the unminified button code is being shipped again.

describe('vditor-toolbar-stubs source file', () => {
  it('exists at the expected path (build.mjs onResolve target)', () => {
    expect(fs.existsSync(stubPath)).toBe(true)
  })

  it('exports the four stub class names build.mjs assumes', () => {
    const src = fs.readFileSync(stubPath, 'utf8')
    expect(src).toMatch(/export class Br\b/)
    expect(src).toMatch(/export class Fullscreen\b/)
    expect(src).toMatch(/export class Record\b/)
    expect(src).toMatch(/export class Export\b/)
  })
})

describe('build.mjs stub plugin', () => {
  it('declares an onResolve filter for the four button modules', () => {
    const src = fs.readFileSync(buildScriptPath, 'utf8')
    // The regex must mention each button name. We don't try to execute
    // the regex here; the bundle-content checks below are the
    // load-bearing assertion.
    expect(src).toMatch(/Br\|Fullscreen\|Record\|Export/)
    expect(src).toMatch(/onResolve/)
    expect(src).toMatch(/vditor-toolbar-stubs/)
  })
})

describe('media/dist/main.js (post-tree-shake)', () => {
  const bundle = fs.readFileSync(bundlePath, 'utf8')

  it('does not contain the Br button className string', () => {
    // Br.ts:5 — `this.element.className = "vditor-toolbar__br";`.
    // If this string reappears, Br.ts is being bundled.
    expect(bundle).not.toContain('vditor-toolbar__br')
  })

  it('does not contain the Fullscreen __s / __n SVG-class swap (quoted)', () => {
    // The `"vditor--fullscreen"` className is also referenced by
    // ui/initUI.ts and util/editorCommonEvent.ts (always bundled), so
    // it's not a clean canary. The literal-string pair "__s" / "__n"
    // is unique to Fullscreen.ts (it swaps button-icon size classes
    // when entering / leaving fullscreen).
    //
    // Have to match with quotes — bare `__n` is also a substring of
    // minified identifiers (e.g. `__name`) inserted by esbuild's
    // helper functions.
    expect(bundle).not.toContain('"__s"')
    expect(bundle).not.toContain('"__n"')
  })

  it('does not contain MediaRecorder / audioprocess references from Record.ts', () => {
    // Record.ts uses navigator.mediaDevices.getUserMedia and
    // mediaRecorder.recorder.onaudioprocess. Either string is a strong
    // signal Record.ts is in the bundle. We check both to be defensive.
    expect(bundle).not.toContain('onaudioprocess')
    expect(bundle).not.toContain('mediaDevices.getUserMedia')
  })

  it('does not contain the Export.ts utility import chain', () => {
    // Export.ts imports exportHTML, exportMarkdown, exportPDF from ../export.
    // These names get minified, but the underlying export/index.ts source
    // references a `addScript` call for the PDF library — checking for
    // its CDN URL fragment is the most stable canary.
    expect(bundle).not.toContain('exportMarkdown')
    expect(bundle).not.toContain('exportPDF')
    // The PDF utility loads html2pdf from CDN; the URL fragment leaks
    // through minification.
    expect(bundle.toLowerCase()).not.toContain('html2pdf')
  })

  it('still contains code from button modules we DO render (negative control)', () => {
    // Sanity check that we're not accidentally stripping everything. The
    // toolbar genuinely uses the Outline and Both buttons, so their unique
    // strings MUST be present. If this fails, the stub plugin or some
    // future tree-shake change has gone too far.
    // Both.ts toggles "vditor-menu--current" on its element.
    expect(bundle).toContain('vditor-menu--current')
  })
})
