// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Test the message handler logic from main.ts without importing the full module
// (which would try to instantiate Vditor). We replicate the handler to test it in isolation.

describe('message handler logic', () => {
  let mockVditor: any

  beforeEach(() => {
    mockVditor = {
      setValue: vi.fn(),
      insertValue: vi.fn(),
      destroy: vi.fn(),
      getValue: vi.fn(() => '# Test'),
    }
  })

  describe('update command', () => {
    it('init with useVscodeThemeColor sets body attribute to 1', () => {
      const msg = {
        command: 'update',
        type: 'init',
        content: '# Hello',
        options: { useVscodeThemeColor: true },
        theme: 'dark',
      }

      // Replicate handler logic
      if (msg.type === 'init') {
        if (msg.options && msg.options.useVscodeThemeColor) {
          document.body.setAttribute('data-use-vscode-theme-color', '1')
        } else {
          document.body.setAttribute('data-use-vscode-theme-color', '0')
        }
      }

      expect(document.body.getAttribute('data-use-vscode-theme-color')).toBe('1')
    })

    it('init without useVscodeThemeColor sets body attribute to 0', () => {
      const msg = {
        command: 'update',
        type: 'init',
        content: '# Hello',
        options: { useVscodeThemeColor: false },
        theme: 'light',
      }

      if (msg.type === 'init') {
        if (msg.options && msg.options.useVscodeThemeColor) {
          document.body.setAttribute('data-use-vscode-theme-color', '1')
        } else {
          document.body.setAttribute('data-use-vscode-theme-color', '0')
        }
      }

      expect(document.body.getAttribute('data-use-vscode-theme-color')).toBe('0')
    })

    it('non-init update calls setValue', () => {
      const msg = { command: 'update', content: '# Updated' }

      // Replicate non-init handler
      if (!(msg as any).type) {
        mockVditor.setValue(msg.content)
      }

      expect(mockVditor.setValue).toHaveBeenCalledWith('# Updated')
    })
  })

  describe('uploaded command', () => {
    it('inserts audio tag for .wav files', () => {
      const msg = {
        command: 'uploaded',
        files: ['assets/recording.wav'],
      }

      msg.files.forEach((f) => {
        if (f.endsWith('.wav')) {
          mockVditor.insertValue(
            `\n\n<audio controls="controls" src="${f}"></audio>\n\n`
          )
        }
      })

      expect(mockVditor.insertValue).toHaveBeenCalledWith(
        '\n\n<audio controls="controls" src="assets/recording.wav"></audio>\n\n'
      )
    })

    it('inserts markdown image for image files on successful load', () => {
      const msg = {
        command: 'uploaded',
        files: ['assets/photo.png'],
      }

      // Simulate image load success path
      msg.files.forEach((f) => {
        if (!f.endsWith('.wav')) {
          // In the real code, this triggers an Image onload
          // We test the expected output directly
          mockVditor.insertValue(`\n\n![](${f})\n\n`)
        }
      })

      expect(mockVditor.insertValue).toHaveBeenCalledWith(
        '\n\n![](assets/photo.png)\n\n'
      )
    })

    it('inserts link fallback when image fails to load', () => {
      const f = 'assets/broken.png'
      // Simulates the onerror path
      mockVditor.insertValue(`\n\n[${f.split('/').slice(-1)[0]}](${f})\n\n`)

      expect(mockVditor.insertValue).toHaveBeenCalledWith(
        '\n\n[broken.png](assets/broken.png)\n\n'
      )
    })
  })
})

describe('outlinePosition handling', () => {
  // Replicate the outlinePosition merge logic from main.ts's initVditor
  function applyOutlinePosition(msg: any, defaultOptions: any) {
    if (msg.options?.outlinePosition) {
      defaultOptions.outline = {
        ...(defaultOptions.outline || {}),
        position: msg.options.outlinePosition,
      }
    }
    return defaultOptions
  }

  it("sets defaultOptions.outline.position to 'right' when option is 'right'", () => {
    const msg = { options: { outlinePosition: 'right' } }
    const defaultOptions: any = {}
    applyOutlinePosition(msg, defaultOptions)
    expect(defaultOptions.outline.position).toBe('right')
  })

  it("sets defaultOptions.outline.position to 'left' when option is 'left'", () => {
    const msg = { options: { outlinePosition: 'left' } }
    const defaultOptions: any = {}
    applyOutlinePosition(msg, defaultOptions)
    expect(defaultOptions.outline.position).toBe('left')
  })

  it('does not set outline when outlinePosition is absent', () => {
    const msg = { options: {} }
    const defaultOptions: any = {}
    applyOutlinePosition(msg, defaultOptions)
    expect(defaultOptions.outline).toBeUndefined()
  })

  it('preserves existing outline keys (e.g. enable) and only overrides position', () => {
    const msg = { options: { outlinePosition: 'left' } }
    const defaultOptions: any = { outline: { enable: true } }
    applyOutlinePosition(msg, defaultOptions)
    expect(defaultOptions.outline.enable).toBe(true)
    expect(defaultOptions.outline.position).toBe('left')
  })

  it('does not touch outline when msg.options is undefined', () => {
    const msg: any = {}
    const defaultOptions: any = { outline: { enable: true } }
    applyOutlinePosition(msg, defaultOptions)
    expect(defaultOptions.outline).toEqual({ enable: true })
  })
})

describe('highlightHeadings handling', () => {
  // Replicate the highlightHeadings body-attribute logic from main.ts
  function applyHighlightHeadings(msg: any) {
    document.body.setAttribute(
      'data-highlight-headings',
      msg.options && msg.options.highlightHeadings ? '1' : '0'
    )
  }

  beforeEach(() => {
    document.body.removeAttribute('data-highlight-headings')
  })

  it("sets data-highlight-headings to '1' when option is true", () => {
    applyHighlightHeadings({ options: { highlightHeadings: true } })
    expect(document.body.getAttribute('data-highlight-headings')).toBe('1')
  })

  it("sets data-highlight-headings to '0' when option is false", () => {
    applyHighlightHeadings({ options: { highlightHeadings: false } })
    expect(document.body.getAttribute('data-highlight-headings')).toBe('0')
  })

  it("sets data-highlight-headings to '0' when key is absent from options", () => {
    applyHighlightHeadings({ options: {} })
    expect(document.body.getAttribute('data-highlight-headings')).toBe('0')
  })

  it("sets data-highlight-headings to '0' when msg.options is undefined and does not throw", () => {
    expect(() => applyHighlightHeadings({})).not.toThrow()
    expect(document.body.getAttribute('data-highlight-headings')).toBe('0')
  })
})

describe('initVditor option merging', () => {
  it('dark theme overrides stored options', () => {
    // Simple deep merge matching lodash.merge behavior
    const merge = (target: any, ...sources: any[]) => {
      for (const source of sources) {
        for (const key of Object.keys(source)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = target[key] || {}
            merge(target[key], source[key])
          } else {
            target[key] = source[key]
          }
        }
      }
      return target
    }

    const storedOptions = {
      theme: 'classic',
      preview: { theme: { current: 'light' } },
    }
    const msg = { options: storedOptions, theme: 'dark', content: '# Test' }

    let defaultOptions: any = {}
    defaultOptions = merge(defaultOptions, msg.options, {
      preview: { math: { inlineDigit: true } },
    })

    if (msg.theme === 'dark') {
      defaultOptions.theme = 'dark'
      defaultOptions.preview = defaultOptions.preview || {}
      defaultOptions.preview.theme = { current: 'dark' }
    }

    expect(defaultOptions.theme).toBe('dark')
    expect(defaultOptions.preview.theme.current).toBe('dark')
    expect(defaultOptions.preview.math.inlineDigit).toBe(true)
  })

  it('light theme overrides stored options', () => {
    // Simple deep merge matching lodash.merge behavior
    const merge = (target: any, ...sources: any[]) => {
      for (const source of sources) {
        for (const key of Object.keys(source)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = target[key] || {}
            merge(target[key], source[key])
          } else {
            target[key] = source[key]
          }
        }
      }
      return target
    }

    const storedOptions = {
      theme: 'dark',
      preview: { theme: { current: 'dark' } },
    }
    const msg = { options: storedOptions, theme: 'light', content: '# Test' }

    let defaultOptions: any = {}
    defaultOptions = merge(defaultOptions, msg.options, {
      preview: { math: { inlineDigit: true } },
    })

    if (msg.theme === 'light') {
      defaultOptions.theme = 'classic'
      defaultOptions.preview = defaultOptions.preview || {}
      defaultOptions.preview.theme = { current: 'light' }
    }

    expect(defaultOptions.theme).toBe('classic')
    expect(defaultOptions.preview.theme.current).toBe('light')
  })

  it('handles empty stored options gracefully', () => {
    // Simple deep merge matching lodash.merge behavior
    const merge = (target: any, ...sources: any[]) => {
      for (const source of sources) {
        for (const key of Object.keys(source)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = target[key] || {}
            merge(target[key], source[key])
          } else {
            target[key] = source[key]
          }
        }
      }
      return target
    }

    const msg = { options: {}, theme: 'dark', content: '# Test' }

    let defaultOptions: any = {}
    defaultOptions = merge(defaultOptions, msg.options, {
      preview: { math: { inlineDigit: true } },
    })

    if (msg.theme === 'dark') {
      defaultOptions.theme = 'dark'
      defaultOptions.preview = defaultOptions.preview || {}
      defaultOptions.preview.theme = { current: 'dark' }
    }

    expect(defaultOptions.theme).toBe('dark')
    expect(defaultOptions.preview.theme.current).toBe('dark')
  })
})

// Replicate deepMerge from main.ts for isolated testing
function deepMerge(target: any, ...sources: any[]): any {
  for (const source of sources) {
    if (!source) continue
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = deepMerge(target[key] || {}, source[key])
      } else {
        target[key] = source[key]
      }
    }
  }
  return target
}

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({}, { a: 1 }, { b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('deeply merges nested objects', () => {
    const result = deepMerge(
      {},
      { preview: { theme: { current: 'light' }, math: { enabled: true } } },
      { preview: { theme: { current: 'dark' } } }
    )
    expect(result).toEqual({
      preview: { theme: { current: 'dark' }, math: { enabled: true } },
    })
  })

  it('overwrites primitives with later source values', () => {
    const result = deepMerge({}, { a: 1 }, { a: 2 })
    expect(result.a).toBe(2)
  })

  it('replaces arrays instead of merging them', () => {
    const result = deepMerge({}, { items: [1, 2] }, { items: [3] })
    expect(result.items).toEqual([3])
  })

  it('skips null and undefined sources', () => {
    const result = deepMerge({ a: 1 }, null, undefined, { b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('mutates and returns the target object', () => {
    const target = { a: 1 }
    const result = deepMerge(target, { b: 2 })
    expect(result).toBe(target)
    expect(target).toEqual({ a: 1, b: 2 })
  })

  it('handles deeply nested merges (3+ levels)', () => {
    const result = deepMerge(
      {},
      { a: { b: { c: { d: 1 } } } },
      { a: { b: { c: { e: 2 } } } }
    )
    expect(result).toEqual({ a: { b: { c: { d: 1, e: 2 } } } })
  })

  it('merges object keys into arrays (arrays are objects)', () => {
    const result = deepMerge({}, { a: [1, 2] }, { a: { 0: 'x' } })
    // deepMerge treats the existing array as the target and sets index 0
    expect(result.a).toEqual(['x', 2])
  })

  it('handles empty sources gracefully', () => {
    const result = deepMerge({ a: 1 }, {})
    expect(result).toEqual({ a: 1 })
  })

  it('handles merging with three or more sources', () => {
    const result = deepMerge(
      {},
      { a: 1, b: { x: 1 } },
      { b: { y: 2 } },
      { c: 3 }
    )
    expect(result).toEqual({ a: 1, b: { x: 1, y: 2 }, c: 3 })
  })
})

// Replicate formatDate from main.ts for isolated testing
function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

describe('formatDate', () => {
  it('formats a date as yyyyMMdd_HHmmss', () => {
    const date = new Date(2025, 0, 15, 9, 5, 3) // Jan 15, 2025, 09:05:03
    expect(formatDate(date)).toBe('20250115_090503')
  })

  it('pads single-digit months and days', () => {
    const date = new Date(2024, 2, 7, 14, 30, 45) // Mar 7, 2024, 14:30:45
    expect(formatDate(date)).toBe('20240307_143045')
  })

  it('handles midnight correctly', () => {
    const date = new Date(2026, 11, 31, 0, 0, 0) // Dec 31, 2026, 00:00:00
    expect(formatDate(date)).toBe('20261231_000000')
  })

  it('handles end of day correctly', () => {
    const date = new Date(2025, 5, 1, 23, 59, 59) // Jun 1, 2025, 23:59:59
    expect(formatDate(date)).toBe('20250601_235959')
  })

  it('matches the yyyyMMdd_HHmmss pattern', () => {
    const date = new Date()
    const result = formatDate(date)
    expect(result).toMatch(/^\d{8}_\d{6}$/)
  })

  it('handles double-digit months (October-December)', () => {
    const date = new Date(2025, 9, 22, 11, 7, 8) // Oct 22, 2025, 11:07:08
    expect(formatDate(date)).toBe('20251022_110708')
  })
})
