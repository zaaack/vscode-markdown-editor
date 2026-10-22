import './preload'

import {
  fileToBase64,
  fixCut,
  fixDarkTheme,
  fixLinkClick,
  fixPanelHover,
  handleToolbarClick,
  saveVditorOptions,
} from './utils'

import { merge } from 'lodash'
import Vditor from 'vditor'
import { format } from 'date-fns'
import 'vditor/dist/index.css'
import { t, lang } from './lang'
import { toolbar } from './toolbar'
import { fixTableIr } from './fix-table-ir'
import { initSearch } from './search'
import './main.css'

// Set to true only for local debugging of scroll-position persistence; verbose and
// not meant to ship enabled (this would spam the console for every scroll event).
const VMD_SCROLL_DEBUG = false
function scrollLog(...args: any[]) {
  if (!VMD_SCROLL_DEBUG) return
  console.log('[vmd-scroll]', ...args)
}

function getScrollEl(): HTMLElement | null {
  // The actual scrollable container isn't always the same node (depends on toolbar
  // pin state / layout), so pick whichever candidate is really overflowing instead of
  // hardcoding one selector.
  const candidates = [
    '.vditor-ir .vditor-reset',
    '.vditor-ir',
    '.vditor-content',
    '.vditor-reset',
  ]
    .map((sel) => document.querySelector<HTMLElement>(sel))
    .filter(Boolean) as HTMLElement[]
  const overflowing = candidates.find((el) => el.scrollHeight - el.clientHeight > 10)
  return overflowing || candidates[0] || null
}

// Reports the current scroll position to the extension host so it can be restored
// later. This matters because the extension host disposes and recreates the whole
// webview whenever a different file is opened (single shared panel / re-resolved
// custom editor), which would otherwise reset the reading position back to the top
// every time you switch files.
//
// Coordinates with restoreScrollPosition() below via a small shared record (rather
// than a simple boolean "restoring" flag): a scroll event whose resulting position
// exactly matches what the restore just programmatically applied is our own echo and
// is ignored; any OTHER position is genuine external input (user or otherwise) and
// must always be reported immediately, even while a restore is still in flight - and
// it also cancels that in-flight restore so the two stop fighting each other.
const vmdRestoreState: { activeCancel: (() => void) | null; lastApplied: number | null } = {
  activeCancel: null,
  lastApplied: null,
}

function trackScrollPosition() {
  if ((window as any).__vmdScrollTracked) return
  ;(window as any).__vmdScrollTracked = true

  document.addEventListener(
    'scroll',
    () => {
      const el = getScrollEl()
      if (!el) return
      if (vmdRestoreState.activeCancel) {
        if (el.scrollTop === vmdRestoreState.lastApplied) {
          // Our own restore just set this value; not a real user scroll.
          return
        }
        scrollLog('scroll during restore diverged to', el.scrollTop, '- treating as user input, cancelling restore')
        vmdRestoreState.activeCancel()
      }
      // Send synchronously on every scroll event, with no debounce/rAF buffering:
      // switching to a different file disposes this webview entirely (it is not
      // merely hidden), so any deferred reporting risks losing the very last
      // position if the switch happens before the timer/frame callback fires.
      scrollLog('reporting scroll', el.scrollTop, 'on', el.className)
      vscode.postMessage({ command: 'scroll', top: el.scrollTop })
    },
    true
  )
}

function restoreScrollPosition(scrollTop: number) {
  scrollLog('restoreScrollPosition called with', scrollTop)
  if (!scrollTop) return
  const el = getScrollEl()
  if (!el) {
    scrollLog('no scroll element found, aborting restore')
    return
  }
  let userScrolled = false
  let done = false

  const apply = () => {
    if (userScrolled || done) return
    el.scrollTop = scrollTop
    vmdRestoreState.lastApplied = scrollTop
  }

  // Large documents keep resizing well past a few hundred milliseconds: mermaid
  // diagrams, tables, and images all finish laying out asynchronously, each shift
  // above the fold moves scrollTop (via Chrome's scroll-anchoring) away from the
  // restored position. Instead of giving up after a short fixed window, keep polling
  // scrollHeight and reapplying until it has been stable for a while, capped at a
  // generous hard timeout so this can't run forever.
  const POLL_MS = 150
  const SETTLE_AFTER_MS = 1200
  const HARD_CAP_MS = 20000
  const startedAt = Date.now()
  let lastHeight = el.scrollHeight
  let lastChangedAt = startedAt

  const cancel = () => {
    if (userScrolled) return
    userScrolled = true
    finish('cancelled - user input')
  }

  const finish = (reason: string) => {
    if (done) return
    done = true
    clearInterval(pollTimer)
    if (vmdRestoreState.activeCancel === cancel) {
      vmdRestoreState.activeCancel = null
      vmdRestoreState.lastApplied = null
    }
    scrollLog('restore finished:', reason, 'elapsed', Date.now() - startedAt, 'ms')
  }

  // Register with the coordinator BEFORE the first apply(), so trackScrollPosition
  // never observes a scroll position we just set without also seeing activeCancel.
  vmdRestoreState.activeCancel = cancel
  apply()

  const pollTimer = setInterval(() => {
    if (userScrolled) {
      finish('user scrolled')
      return
    }
    const now = Date.now()
    const h = el.scrollHeight
    if (h !== lastHeight) {
      lastHeight = h
      lastChangedAt = now
      apply()
      scrollLog('height changed to', h, 're-applied scrollTop', scrollTop, '-> actual', el.scrollTop)
    }
    if (now - lastChangedAt >= SETTLE_AFTER_MS) {
      finish('settled')
    } else if (now - startedAt >= HARD_CAP_MS) {
      finish('hard cap reached')
    }
  }, POLL_MS)
}

// Chromium puts the caret at the START of a line when you click in the empty space to
// the right of a line that begins with an inline node (e.g. `**bold**`): Vditor's
// collapsed markers are zero-size inline-blocks, and hit-testing resolves to the first
// one instead of the end of the line. Re-place the caret at the end of the clicked line.
function fixClickPastLineEnd(e: MouseEvent) {
  const root = document.querySelector<HTMLElement>('.vditor-ir .vditor-reset')
  const target = e.target as HTMLElement | null
  if (!root || !target || e.button !== 0 || e.shiftKey || !root.contains(target)) return
  if (!/^(LI|P|H[1-6]|BLOCKQUOTE)$/.test(target.tagName)) return
  const sel = window.getSelection()
  if (!sel || !sel.isCollapsed) return

  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
  let best: { node: Text; rect: DOMRect } | null = null
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node as Text
    // Skip text belonging to nested blocks (e.g. a sub-list inside this <li>)
    if (!text.data || text.parentElement?.closest('li, p, h1, h2, h3, h4, h5, h6, blockquote') !== target) continue
    const range = document.createRange()
    range.selectNodeContents(text)
    for (const r of Array.from(range.getClientRects())) {
      if (r.height === 0 || e.clientY < r.top || e.clientY > r.bottom) continue
      if (!best || r.right > best.rect.right) best = { node: text, rect: r }
    }
  }
  if (!best || e.clientX <= best.rect.right) return

  let offset = best.node.length
  const probe = document.createRange()
  for (; offset > 0; offset--) {
    probe.setStart(best.node, offset)
    probe.collapse(true)
    const r = probe.getClientRects()[0]
    if (r && r.top >= best.rect.top - 1 && r.bottom <= best.rect.bottom + 1) break
  }
  const caret = document.createRange()
  caret.setStart(best.node, offset)
  caret.collapse(true)
  sel.removeAllRanges()
  sel.addRange(caret)
}

// Last markdown this webview pushed to the extension; used to recognise echoes of our
// own edits so they never reset the editor (setValue throws the caret to line 1).
let lastSentContent: string | null = null

function getIrEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.vditor-ir .vditor-reset')
}

// Caret position as a character offset into the IR element's text, or null if the
// caret isn't inside the editor.
function saveCaretOffset(root: HTMLElement): number | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) return null
  const range = document.createRange()
  range.selectNodeContents(root)
  range.setEnd(sel.anchorNode as Node, sel.anchorOffset)
  return range.toString().length
}

function restoreCaretOffset(root: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let node: Node | null
  let last: Node | null = null
  while ((node = walker.nextNode())) {
    last = node
    const len = node.textContent?.length || 0
    if (remaining <= len) {
      const range = document.createRange()
      range.setStart(node, remaining)
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      return
    }
    remaining -= len
  }
  if (last) {
    const range = document.createRange()
    range.setStart(last, last.textContent?.length || 0)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
}

// Applies a document change that originated outside this webview. Skips no-op updates
// (our own edits echoed back) and keeps the caret/scroll where the user was typing
// instead of letting setValue reset them to the top of the document.
function applyExternalContent(content: string) {
  if (content === lastSentContent || content === vditor.getValue()) {
    return
  }
  const root = getIrEl()
  const caret = root ? saveCaretOffset(root) : null
  const scrollEl = getScrollEl()
  const scrollTop = scrollEl ? scrollEl.scrollTop : 0
  vditor.setValue(content)
  lastSentContent = content
  const newRoot = getIrEl()
  if (newRoot && caret !== null) {
    restoreCaretOffset(newRoot, caret)
  }
  if (scrollEl) scrollEl.scrollTop = scrollTop
}

function initVditor(msg) {
  console.log('msg', msg)
  // Hide the editor again for the duration of this (re)build - see main.css and the
  // matching reveal at the end of after() below. Needed on every call, not just the
  // first: a re-init can also happen without a full page reload (e.g. a VS Code theme
  // change reuses the same webview), which would otherwise skip re-hiding and show
  // the intermediate rebuild state.
  document.body.removeAttribute('data-vmd-ready')
  lastSentContent = null
  let inputTimer
  let defaultOptions: any = {}
  defaultOptions = merge(defaultOptions, msg.options, {
    preview: {
      math: {
        inlineDigit: true,
      }
    }
  })
  // Apply theme from VS Code AFTER merge so it takes precedence over stored options
  if (msg.theme === 'dark') {
    defaultOptions.theme = 'dark'
    defaultOptions.preview = defaultOptions.preview || {}
    defaultOptions.preview.theme = { current: 'dark' }
  } else if (msg.theme === 'light') {
    defaultOptions.theme = 'classic'
    defaultOptions.preview = defaultOptions.preview || {}
    defaultOptions.preview.theme = { current: 'light' }
  }
  if (window.vditor) {
    vditor.destroy()
    window.vditor = null
  }
  window.vditor = new Vditor('app', {
    width: '100%',
    height: '100%',
    minHeight: '100%',
    lang,
    value: msg.content,
    mode: 'ir',
    cache: { enable: false },
    toolbar,
    toolbarConfig: { pin: true },
    ...defaultOptions,
    after() {
      fixDarkTheme()
      handleToolbarClick()
      fixTableIr()
      fixPanelHover()
      vditor.focus()
      // Initialize search bar once (idempotent across vditor re-inits)
      if (!(window as any).__vmdSearch) {
        ;(window as any).__vmdSearch = initSearch()
      }
      trackScrollPosition()
      if (!(window as any).__vmdClickFix) {
        ;(window as any).__vmdClickFix = true
        document.addEventListener('mouseup', fixClickPastLineEnd)
      }
      restoreScrollPosition(msg.scrollTop)
      // Reveal the editor (see main.css) only once Vditor's own DOM/CSS has fully
      // settled and the saved scroll position has already been applied, so the very
      // first thing the user ever sees is the final state - never an intermediate,
      // oddly-scaled toolbar or a visible jump from the top to the restored position.
      requestAnimationFrame(() => {
        document.body.setAttribute('data-vmd-ready', '1')
      })
    },
    input() {
      inputTimer && clearTimeout(inputTimer)
      inputTimer = setTimeout(() => {
        lastSentContent = vditor.getValue()
        vscode.postMessage({ command: 'edit', content: lastSentContent })
      }, 100)
    },
    upload: {
      url: '/fuzzy', // 没有 url 参数粘贴图片无法上传 see: https://github.com/Vanessa219/vditor/blob/d7628a0a7cfe5d28b055469bf06fb0ba5cfaa1b2/src/ts/util/fixBrowserBehavior.ts#L1409
      async handler(files) {
        // console.log('files', files)
        let fileInfos = await Promise.all(
          files.map(async (f) => {
            const d = new Date()
            return {
              base64: await fileToBase64(f),
              name: `${format(new Date(), 'yyyyMMdd_HHmmss')}_${f.name}`.replace(
                /[^\w-_.]+/,
                '_'
              ),
            }
          })
        )
        vscode.postMessage({
          command: 'upload',
          files: fileInfos,
        })
      },
    },
  })
}

window.addEventListener('message', (e) => {
  const msg = e.data
  // console.log('msg from vscode', msg)
  switch (msg.command) {
    case 'update': {
      if (msg.type === 'init') {
        if (msg.options && msg.options.useVscodeThemeColor) {
          document.body.setAttribute('data-use-vscode-theme-color', '1')
        } else {
          document.body.setAttribute('data-use-vscode-theme-color', '0')
        }
        try {
          initVditor(msg)
        } catch (error) {
          // reset options when error
          console.error(error)
          initVditor({ content: msg.content })
          saveVditorOptions()
        }
        console.log('initVditor')
      } else {
        applyExternalContent(msg.content)
      }
      break
    }
    case 'focus': {
      vditor.focus()
      break
    }
    case 'uploaded': {
      msg.files.forEach((f) => {
        if (f.endsWith('.wav')) {
          vditor.insertValue(
            `\n\n<audio controls="controls" src="${f}"></audio>\n\n`
          )
        } else {
          const i = new Image()
          i.src = f
          i.onload = () => {
            vditor.insertValue(`\n\n![](${f})\n\n`)
          }
          i.onerror = () => {
            vditor.insertValue(`\n\n[${f.split('/').slice(-1)[0]}](${f})\n\n`)
          }
        }
      })
      break
    }
    default:
      break
  }
})

fixLinkClick()
fixCut()

vscode.postMessage({ command: 'ready' })
