import { bench, describe } from 'vitest'

// Replicates the deepMerge currently shipping in media-src/src/main.ts.
// We benchmark this against simpler alternatives in case it ever becomes
// the hot path. Historically this bench compared lodash.merge, but main.ts
// no longer depends on lodash — it uses this hand-rolled function instead.
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

describe('option merging (deepMerge vs alternatives)', () => {
  const storedOptions = {
    theme: 'dark',
    mode: 'ir',
    preview: {
      theme: { current: 'dark' },
      math: { engine: 'KaTeX' },
    },
  }

  const mathOverride = {
    preview: { math: { inlineDigit: true } },
  }

  bench('deepMerge (current)', () => {
    let defaultOptions: any = {}
    defaultOptions = deepMerge(defaultOptions, storedOptions, mathOverride)
    defaultOptions.theme = 'dark'
    defaultOptions.preview.theme = { current: 'dark' }
  })

  bench('structuredClone + Object.assign', () => {
    let defaultOptions: any = structuredClone(storedOptions)
    Object.assign(defaultOptions, mathOverride)
    defaultOptions.preview = {
      ...defaultOptions.preview,
      ...mathOverride.preview,
      math: { ...defaultOptions.preview?.math, ...mathOverride.preview?.math },
    }
    defaultOptions.theme = 'dark'
    defaultOptions.preview.theme = { current: 'dark' }
  })

  bench('JSON parse/stringify + spread', () => {
    let defaultOptions: any = JSON.parse(JSON.stringify(storedOptions))
    defaultOptions.preview = defaultOptions.preview || {}
    defaultOptions.preview.math = {
      ...defaultOptions.preview.math,
      ...mathOverride.preview.math,
    }
    defaultOptions.theme = 'dark'
    defaultOptions.preview.theme = { current: 'dark' }
  })
})

// Benchmark theme application logic
describe('theme application', () => {
  bench('dark theme override', () => {
    const defaultOptions: any = {
      theme: 'classic',
      preview: { theme: { current: 'light' }, math: { inlineDigit: true } },
    }
    defaultOptions.theme = 'dark'
    defaultOptions.preview = defaultOptions.preview || {}
    defaultOptions.preview.theme = { current: 'dark' }
  })

  bench('light theme override', () => {
    const defaultOptions: any = {
      theme: 'dark',
      preview: { theme: { current: 'dark' }, math: { inlineDigit: true } },
    }
    defaultOptions.theme = 'classic'
    defaultOptions.preview = defaultOptions.preview || {}
    defaultOptions.preview.theme = { current: 'light' }
  })
})

// Benchmark filename sanitization from upload handler
describe('upload filename generation', () => {
  bench('date format + sanitize (single file)', () => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    const name = `${ts}_screenshot (2).png`.replace(/[^\w-_.]+/, '_')
    if (!name) throw new Error()
  })

  bench('date format + sanitize (5 files batch)', () => {
    for (let i = 0; i < 5; i++) {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
      const name = `${ts}_file_${i}.png`.replace(/[^\w-_.]+/, '_')
      if (!name) throw new Error()
    }
  })
})
