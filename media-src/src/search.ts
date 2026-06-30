/**
 * In-editor find bar using the CSS Custom Highlight API.
 * No DOM mutations to the vditor editing area — highlights are rendered by the browser
 * purely via ::highlight() pseudo-elements, so vditor's internal state is never touched.
 */

let searchRanges: Range[] = []
let currentIndex = -1
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getEditorRoot(): Element | null {
  return (
    document.querySelector('.vditor-ir .vditor-reset') ||
    document.querySelector('.vditor-wysiwyg .vditor-reset') ||
    document.querySelector('.vditor-sv .vditor-reset')
  )
}

function findAllRanges(query: string, caseSensitive: boolean): Range[] {
  const root = getEditorRoot()
  if (!root || !query) return []

  const flags = caseSensitive ? 'g' : 'gi'
  const regex = new RegExp(escapeRegex(query), flags)
  const ranges: Range[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const text = node.textContent || ''
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const range = document.createRange()
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      ranges.push(range)
    }
  }
  return ranges
}

function applyHighlights(ranges: Range[], activeIdx: number) {
  if (typeof CSS === 'undefined' || !CSS.highlights) return

  if (ranges.length > 0) {
    CSS.highlights.set('vmd-search-result', new (window as any).Highlight(...ranges))
  } else {
    CSS.highlights.delete('vmd-search-result')
  }

  if (activeIdx >= 0 && activeIdx < ranges.length) {
    CSS.highlights.set('vmd-search-current', new (window as any).Highlight(ranges[activeIdx]))
  } else {
    CSS.highlights.delete('vmd-search-current')
  }
}

function clearHighlights() {
  if (typeof CSS !== 'undefined' && CSS.highlights) {
    CSS.highlights.delete('vmd-search-result')
    CSS.highlights.delete('vmd-search-current')
  }
  searchRanges = []
  currentIndex = -1
}

function scrollToActive(ranges: Range[], idx: number) {
  if (idx < 0 || idx >= ranges.length) return
  try {
    const el = ranges[idx].startContainer.parentElement
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  } catch (_) {
    // range may be stale after a content mutation
  }
}

export function initSearch() {
  // Inject highlight pseudo-element styles
  const style = document.createElement('style')
  style.textContent = `
    ::highlight(vmd-search-result) {
      background-color: rgba(255, 216, 0, 0.38);
      color: inherit;
    }
    ::highlight(vmd-search-current) {
      background-color: rgba(255, 130, 0, 0.65);
      color: inherit;
    }
  `
  document.head.appendChild(style)

  // Build the search bar
  const bar = document.createElement('div')
  bar.id = 'vmd-search-bar'
  bar.setAttribute('aria-hidden', 'true')
  bar.innerHTML = `
    <input id="vmd-search-input" type="text" placeholder="Find…" spellcheck="false" autocomplete="off" />
    <span id="vmd-search-count"></span>
    <button id="vmd-search-prev" title="Previous match (Shift+Enter)">&#9650;</button>
    <button id="vmd-search-next" title="Next match (Enter)">&#9660;</button>
    <label id="vmd-search-case-label" title="Match case">
      <input type="checkbox" id="vmd-search-case" /> Aa
    </label>
    <button id="vmd-search-close" title="Close (Esc)">&#10005;</button>
  `
  document.body.appendChild(bar)

  const input = document.getElementById('vmd-search-input') as HTMLInputElement
  const countEl = document.getElementById('vmd-search-count') as HTMLSpanElement
  const prevBtn = document.getElementById('vmd-search-prev') as HTMLButtonElement
  const nextBtn = document.getElementById('vmd-search-next') as HTMLButtonElement
  const caseCheckbox = document.getElementById('vmd-search-case') as HTMLInputElement
  const closeBtn = document.getElementById('vmd-search-close') as HTMLButtonElement

  let isOpen = false

  function open() {
    isOpen = true
    bar.classList.add('vmd-search-bar--open')
    bar.setAttribute('aria-hidden', 'false')
    input.focus()
    input.select()
    if (input.value) runSearch()
  }

  function close() {
    isOpen = false
    bar.classList.remove('vmd-search-bar--open')
    bar.setAttribute('aria-hidden', 'true')
    clearHighlights()
    countEl.textContent = ''
  }

  function updateCount() {
    const total = searchRanges.length
    countEl.textContent = total > 0 ? `${currentIndex + 1}/${total}` : input.value ? '0/0' : ''
    countEl.classList.toggle('vmd-search-count--nomatch', total === 0 && input.value.length > 0)
  }

  function runSearch() {
    searchRanges = findAllRanges(input.value, caseCheckbox.checked)
    currentIndex = searchRanges.length > 0 ? 0 : -1
    applyHighlights(searchRanges, currentIndex)
    if (currentIndex >= 0) scrollToActive(searchRanges, currentIndex)
    updateCount()
  }

  function goNext() {
    if (searchRanges.length === 0) return
    currentIndex = (currentIndex + 1) % searchRanges.length
    applyHighlights(searchRanges, currentIndex)
    scrollToActive(searchRanges, currentIndex)
    updateCount()
  }

  function goPrev() {
    if (searchRanges.length === 0) return
    currentIndex = (currentIndex - 1 + searchRanges.length) % searchRanges.length
    applyHighlights(searchRanges, currentIndex)
    scrollToActive(searchRanges, currentIndex)
    updateCount()
  }

  input.addEventListener('input', runSearch)
  caseCheckbox.addEventListener('change', runSearch)

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.shiftKey ? goPrev() : goNext()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  })

  prevBtn.addEventListener('click', goPrev)
  nextBtn.addEventListener('click', goNext)
  closeBtn.addEventListener('click', close)

  // Ctrl+F / Cmd+F — intercept before the browser or VS Code handles it
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'f') {
      e.preventDefault()
      e.stopPropagation()
      open()
    }
  }, true)

  // When editor content changes, re-run the search so highlight ranges stay valid
  const observeRoot = () => {
    const root = getEditorRoot()
    if (!root) return

    new MutationObserver(() => {
      if (!isOpen || !input.value) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(runSearch, 300)
    }).observe(root, { childList: true, subtree: true, characterData: true })
  }

  // Delay observation until vditor has fully mounted
  setTimeout(observeRoot, 1000)

  return { open, close }
}
