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

export function handleToolbarClick() {
  $(
    '.vditor-toolbar .vditor-panel--left button, .vditor-toolbar .vditor-panel--arrow button'
  ).on('click', (e) => {
    setTimeout(() => {
      saveVditorOptions()
    }, 500)
  })
}
