// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// toolbar.ts imports from './utils', which in turn imports jquery,
// jquery-confirm, vditor, and calls acquireVsCodeApi at module load time.
// Mock the whole module so the import is side-effect free.
vi.mock('../../media-src/src/utils', () => ({
  confirm: vi.fn(),
}))

import { toolbar } from '../../media-src/src/toolbar'

describe('toolbar array', () => {
  it('contains a top-level entry with name === "outline"', () => {
    const outline = (toolbar as any[]).find((it) => it && it.name === 'outline')
    expect(outline).toBeDefined()
  })

  it('outline entry has a tip and icon defined', () => {
    const outline = (toolbar as any[]).find((it) => it && it.name === 'outline')
    expect(outline.tip).toBe('Outline')
    expect(typeof outline.icon).toBe('string')
    expect(outline.icon.length).toBeGreaterThan(0)
    expect(outline.icon).toContain('<svg')
  })

  it("does NOT contain a bare 'outline' string in the 'more' submenu", () => {
    const more = (toolbar as any[]).find((it) => it && it.name === 'more')
    expect(more).toBeDefined()
    expect(Array.isArray(more.toolbar)).toBe(true)
    // Submenu items are either strings or objects with `name`.
    const hasBareOutline = more.toolbar.some(
      (it: any) => it === 'outline' || (it && it.name === 'outline')
    )
    expect(hasBareOutline).toBe(false)
  })

  it("places 'outline' between 'find' and 'edit-mode'", () => {
    const names = (toolbar as any[]).map((it) => it && it.name)
    const findIdx = names.indexOf('find')
    const outlineIdx = names.indexOf('outline')
    const editModeIdx = names.indexOf('edit-mode')
    expect(findIdx).toBeGreaterThanOrEqual(0)
    expect(outlineIdx).toBeGreaterThan(findIdx)
    expect(editModeIdx).toBeGreaterThan(outlineIdx)
  })

  it("preserves the 'find' button with its click handler and tip", () => {
    const find = (toolbar as any[]).find((it) => it && it.name === 'find')
    expect(find).toBeDefined()
    expect(find.tip).toBe('Find (⌘F)')
    expect(typeof find.icon).toBe('string')
    expect(find.icon).toContain('<svg')
    expect(typeof find.click).toBe('function')
  })

  it("preserves the save button's ⌘s hotkey", () => {
    const save = (toolbar as any[]).find((it) => it && it.name === 'save')
    expect(save).toBeDefined()
    expect(save.hotkey).toBe('⌘s')
    expect(typeof save.click).toBe('function')
  })

  it('normalizes every entry to an object with a name and tipPosition', () => {
    // toolbar.ts maps every entry through a normalizer that converts strings
    // to objects and defaults tipPosition to 's'.
    for (const it of toolbar as any[]) {
      expect(typeof it).toBe('object')
      expect(typeof it.name).toBe('string')
      expect(typeof it.tipPosition).toBe('string')
    }
  })
})
