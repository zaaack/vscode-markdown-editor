import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EDIT_DEBOUNCE_MS } from '../../media-src/src/config'

describe('EDIT_DEBOUNCE_MS', () => {
  it('is set to 250 ms', () => {
    expect(EDIT_DEBOUNCE_MS).toBe(250)
  })

  it('is at least 100 ms (anything below buys nothing)', () => {
    expect(EDIT_DEBOUNCE_MS).toBeGreaterThanOrEqual(100)
  })

  it('is at most 400 ms (above this users perceive lag on save+lint)', () => {
    expect(EDIT_DEBOUNCE_MS).toBeLessThanOrEqual(400)
  })
})

describe('debounce semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces rapid keystrokes into a single edit message', () => {
    // Replicate the input handler shape from main.ts so the timing
    // contract is testable in isolation.
    const post = vi.fn()
    let timer: ReturnType<typeof setTimeout> | undefined
    const onInput = () => {
      timer && clearTimeout(timer)
      timer = setTimeout(() => {
        post({ command: 'edit', content: 'x' })
      }, EDIT_DEBOUNCE_MS)
    }

    // 10 keystrokes spread over 100 ms
    for (let i = 0; i < 10; i++) {
      onInput()
      vi.advanceTimersByTime(10)
    }
    // Still inside the debounce window — nothing posted yet.
    expect(post).not.toHaveBeenCalled()

    // Advance past the debounce.
    vi.advanceTimersByTime(EDIT_DEBOUNCE_MS)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('emits once the user stops typing for EDIT_DEBOUNCE_MS', () => {
    const post = vi.fn()
    let timer: ReturnType<typeof setTimeout> | undefined
    const onInput = () => {
      timer && clearTimeout(timer)
      timer = setTimeout(() => post({ command: 'edit' }), EDIT_DEBOUNCE_MS)
    }

    onInput()
    vi.advanceTimersByTime(EDIT_DEBOUNCE_MS - 1)
    expect(post).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(post).toHaveBeenCalledTimes(1)
  })
})
