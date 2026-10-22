import { keyboard } from '@testing-library/user-event/dist/keyboard'
import $ from 'jquery'
require('jquery-confirm')(window, $)
import 'jquery-confirm/css/jquery-confirm.css'

import _ from 'lodash'
import Vditor from 'vditor'
window.vscode =
  (window as any).acquireVsCodeApi && (window as any).acquireVsCodeApi()
;(window as any).global = window

declare global {
  export const vditor: Vditor
  export const vscode: any
  interface Window {
    vditor: Vditor
    vscode: any
    global: Window
  }
}

export function confirm(msg, onOk) {
  $.confirm({
    title: '',
    animation: 'top',
    closeAnimation: 'top',
    animateFromElement: false,
    boxWidth: '300px',
    useBootstrap: false,
    content: msg,
    buttons: {
      cancel: {
        text: 'Cancel',
      },
      confirm: {
        text: 'Confirm',
        action: onOk,
      },
    },
  })
}
// 切换 content-theme 时自动修改 vditor theme
export function fixDarkTheme() {
  let $ct = document.querySelector('[data-type="content-theme"]')
  $ct.nextElementSibling.addEventListener('click', (e) => {
    if ((e.target as any).tagName !== 'BUTTON') return
    let type = (e.target as any).getAttribute('data-type')
    if (type === 'dark') {
      vditor.setTheme(type)
    } else {
      vditor.setTheme('classic')
    }
  })
}
// panel hover 加定时延迟
export function fixPanelHover() {
  $('.vditor-panel').each((i, e) => {
    let timer
    $(e)
      .on('mouseenter', (e) => {
        timer && clearTimeout(timer)
        e.currentTarget.classList.add('vditor-panel_hover')
      })
      .on('mouseleave', (e) => {
        let el = e.currentTarget
        timer = setTimeout(() => {
          el.classList.remove('vditor-panel_hover')
        }, 2000)
      })
  })
}
// 文件转base64用于传输
export const fileToBase64 = async (file) => {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = function (evt) {
      res(evt.target.result.toString().split(',')[1])
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}
// 保存 vditor 配置到 vscode 同步存储
export function saveVditorOptions() {
  let vditorOptions = {
    theme: vditor.vditor.options.theme,
    mode: vditor.vditor.currentMode,
    preview: vditor.vditor.options.preview,
  }
  vscode.postMessage({
    command: 'save-options',
    options: vditorOptions,
  })
}
// toolbar 点击时保存配置
export function handleToolbarClick() {
  $(
    '.vditor-toolbar .vditor-panel--left button, .vditor-toolbar .vditor-panel--arrow button'
  ).on('click', (e) => {
    setTimeout(() => {
      saveVditorOptions()
    }, 500)
  })
}

/**
 * Approximates the GitHub-style heading slug so in-page `#anchor` links (e.g. a Table
 * of Contents) can be matched against the rendered heading text.
 */
function slugifyHeading(text: string): string {
  return text
    .trim()
    // Vditor's IR mode keeps the literal `#`/`##`/... marker as part of the heading's
    // textContent, unlike the final rendered output, so strip it first.
    .replace(/^#{1,6}\s*/, '')
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\- ]+/gu, '')
    // GitHub's heading slugger replaces each space individually rather than collapsing
    // runs of whitespace, so e.g. "Foo & Bar" (which becomes "foo  bar" once the "&" is
    // stripped) turns into "foo--bar", not "foo-bar".
    .replace(/ /g, '-')
}

/**
 * Scrolls to the heading matching an in-page `#anchor` link. Returns true if a match
 * was found and scrolled to.
 */
function scrollToHeadingAnchor(fragment: string): boolean {
  const target = decodeURIComponent(fragment).toLowerCase()
  const headings = document.querySelectorAll(
    '.vditor-reset h1, .vditor-reset h2, .vditor-reset h3, .vditor-reset h4, .vditor-reset h5, .vditor-reset h6'
  )
  for (const h of Array.from(headings)) {
    if (slugifyHeading(h.textContent || '') === target) {
      h.scrollIntoView({ block: 'start', behavior: 'smooth' })
      return true
    }
  }
  return false
}

/**
 * Resolves a reference-style link (`[text][label]`, `[label][]` or `[label]`) to the URL
 * of its `[label]: url` definition in the current document.
 */
function resolveReferenceLink(refEl: HTMLElement): string | undefined {
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  // In IR mode the label lives in a `--link` marker as `[label]` when explicit; for the
  // collapsed/shortcut forms it is the link text itself.
  const explicit = refEl
    .querySelector('.vditor-ir__marker--link')
    ?.textContent?.match(/^\[(.*)\]$/)?.[1]
  const text = refEl.children[1]?.textContent || ''
  const label = normalize(explicit || text)
  if (!label) return undefined

  const markdown: string = (window as any).vditor?.getValue?.() || ''
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]*)>|(\S+))/)
    if (m && !m[1].startsWith('^') && normalize(m[1]) === label) {
      return m[2] ?? m[3]
    }
  }
  return undefined
}

/**
 * Sends raw Markdown link targets to the extension host for opening.
 */
export function fixLinkClick() {
  let lastOpen = { href: '', at: 0 }
  const openLink = (url: string) => {
    // Vditor's own click handler calls window.open (patched below) and the document
    // click listener also fires for the same click, which would open the link twice.
    const now = Date.now()
    if (url === lastOpen.href && now - lastOpen.at < 500) return
    lastOpen = { href: url, at: now }
    vscode.postMessage({ command: 'open-link', href: url })
  }
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const link = target.closest('a')
    // Vditor's IR mode never renders a real `<a href>` for links: it always shows the
    // raw markdown syntax, with the url held in a `.vditor-ir__marker--link` marker
    // span inside a `[data-type="a"]` wrapper, instead of a real anchor element.
    const irLinkMarker = target
      .closest<HTMLElement>('[data-type="a"]')
      ?.querySelector('.vditor-ir__marker--link')
    const refEl = target.closest<HTMLElement>('[data-type="link-ref"]')
    const href =
      link?.getAttribute('href') ||
      irLinkMarker?.textContent ||
      (refEl && resolveReferenceLink(refEl)) ||
      undefined

    if (!href) return
    e.preventDefault()
    e.stopPropagation()
    if (href.startsWith('#')) {
      scrollToHeadingAnchor(href.slice(1))
      return
    }
    openLink(href)
  })
  window.open = (url: string, ...args: any[]) => {
    openLink(url)
    return window
  }
}


/** error:
 We don't execute document.execCommand() this time, because it is called recursively.
(anonymous) @ main.js:32449
(anonymous) @ main.js:842
(anonymous) @ host.js:27
see: https://github.com/nwjs/nw.js/issues/3403 */
export function fixCut() {
  let _exec = document.execCommand.bind(document)
  document.execCommand = (cmd, ...args) => {
    if (cmd === 'delete') {
      setTimeout(() => {
        return _exec(cmd, ...args)
      })
    } else {
      return _exec(cmd, ...args)
    }
  }
}
