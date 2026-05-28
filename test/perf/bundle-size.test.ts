import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const distDir = path.resolve(__dirname, '../../media/dist')
const jsPath = path.join(distDir, 'main.js')
const cssPath = path.join(distDir, 'main.css')

const KB = 1024
const JS_BUNDLE_MAX_KB = 500
const CSS_BUNDLE_MAX_KB = 80

describe('media/dist bundle', () => {
  it('media/dist/main.css exists and is non-empty', () => {
    expect(fs.existsSync(cssPath)).toBe(true)
    const stat = fs.statSync(cssPath)
    expect(stat.size).toBeGreaterThan(0)
  })

  it('media/dist/main.css is minified (no source-readable indentation in style code)', () => {
    const css = fs.readFileSync(cssPath, 'utf8')

    // esbuild preserves legal /*! ... */ banner comments verbatim — that's
    // intentional (license attribution) and not a minification failure.
    // Strip them before checking for "real" indentation.
    const withoutBanners = css.replace(/\/\*![\s\S]*?\*\//g, '')

    const indentLines = withoutBanners
      .split('\n')
      .filter((l) => /^(  |\t)/.test(l))
    expect(indentLines.length).toBe(0)

    // Newline count after banners removed should be tiny. A non-minified
    // bundle (raw vditor index.css concatenated) would have hundreds.
    const newlines = (withoutBanners.match(/\n/g) ?? []).length
    expect(newlines).toBeLessThan(20)

    // Sanity: it should actually look like CSS.
    expect(css).toMatch(/\{[^}]+\}/)
  })

  it('media/dist/main.css stays under the soft size cap', () => {
    const stat = fs.statSync(cssPath)
    const kb = stat.size / KB
    expect(kb).toBeLessThan(CSS_BUNDLE_MAX_KB)
  })

  it('media/dist/main.js exists and is non-empty', () => {
    expect(fs.existsSync(jsPath)).toBe(true)
    const stat = fs.statSync(jsPath)
    expect(stat.size).toBeGreaterThan(0)
  })

  it('media/dist/main.js stays under the soft size cap', () => {
    // Historical baseline: original fork was ~805 KB. This fork shipped 407 KB
    // after the bundle-reduction work. Cap at 500 KB to allow some headroom
    // while catching accidental regressions (e.g. someone re-introducing a
    // heavy dep, or accidentally turning off --minify).
    const stat = fs.statSync(jsPath)
    const kb = stat.size / KB
    expect(kb).toBeLessThan(JS_BUNDLE_MAX_KB)
  })

  it('media/dist/main.js is minified (no human-written line comments)', () => {
    const js = fs.readFileSync(jsPath, 'utf8')

    // esbuild --minify strips // line comments. If the bundle contains any
    // " // " followed by words, that's a strong signal minification is off.
    // We allow URLs (https://...) and the //# sourceMappingURL footer.
    const lines = js.split('\n')
    const suspiciousComments = lines.filter((line) => {
      const trimmed = line.trimStart()
      if (!trimmed.startsWith('//')) return false
      if (trimmed.startsWith('//# sourceMappingURL=')) return false
      return true
    })
    expect(suspiciousComments.length).toBe(0)
  })
})
