import { keyboard } from '@testing-library/user-event/dist/keyboard'
import $ from 'jquery'

let tablePanel = null
let disableVscodeHotkeys = false

// fork from vditor
const updateHotkeyTip = (hotkey) => {
  if (/Mac/.test(navigator.platform) || navigator.platform === 'iPhone') {
    // if (hotkey.indexOf("⇧") > -1 && isFirefox()) {
    //     // Mac Firefox 按下 shift 后，key 同 windows 系统
    //     hotkey = hotkey.replace(";", ":").replace("=", "+").replace("-", "_");
    // }
  } else {
    if (hotkey.startsWith('⌘')) {
      hotkey = hotkey.replace('⌘', '⌘+')
    } else if (hotkey.startsWith('⌥') && hotkey.substr(1, 1) !== '⌘') {
      hotkey = hotkey.replace('⌥', '⌥+')
    } else {
      hotkey = hotkey.replace('⇧⌘', '⌘+⇧+').replace('⌥⌘', '⌥+⌘+')
    }
    hotkey = hotkey
      .replace('⌘', 'Ctrl')
      .replace('⇧', 'Shift')
      .replace('⌥', 'Alt')
    if (hotkey.indexOf('Shift') > -1) {
      hotkey = hotkey.replace(';', ':').replace('=', '+').replace('-', '_')
    }
  }
  return hotkey
}

export function fixTableIr() {
  if (!tablePanel) {
    tablePanel = document.createElement('div')
    vditor.vditor.element.appendChild(tablePanel)
    tablePanel.innerHTML = `<div
    class="vditor-panel vditor-panel--none vditor-panel-ir"
    data-top="73"
    style="left: 35px; top: 73px;display:none"
  >
   <button
      type="button"
      aria-label="居左<${updateHotkeyTip('⇧⌘L')}>"
      data-type="left"
      class="vditor-icon vditor-tooltipped vditor-tooltipped__n vditor-icon--current"
    >
      <svg><use xlink:href="#vditor-icon-align-left"></use></svg></button
    ><button
      type="button"
      aria-label="居中<${updateHotkeyTip('⇧⌘C')}>"
      data-type="center"
      class="vditor-icon vditor-tooltipped vditor-tooltipped__n"
    >
      <svg><use xlink:href="#vditor-icon-align-center"></use></svg></button
    ><button
      type="button"
      aria-label="居右<${updateHotkeyTip('⇧⌘R')}>"
      data-type="right"
      class="vditor-icon vditor-tooltipped vditor-tooltipped__n"
    >
      <svg><use xlink:href="#vditor-icon-align-right"></use></svg></button
    ><button
      type="button"
      aria-label="在上方插入一行<${updateHotkeyTip('⇧⌘F')}>"
      data-type="insertRowA"
      class="vditor-icon vditor-tooltipped vditor-tooltipped__n"
    >
      <svg><use xlink:href="#vditor-icon-insert-rowb"></use></svg></button
    ><button
      type="button"
      aria-label="在下方插入一行<${updateHotkeyTip('⌘=')}>"
      data-type="insertRowB"
      class="vditor-icon vditor-tooltipped vditor-tooltipped__n"
    >
      <svg><use xlink:href="#vditor-icon-insert-row"></use></svg></button
    ><button
      type="button"
      aria-label="在左边插入一列<${updateHotkeyTip('⇧⌘G')}>"
      data-type="insertColumnL"
      class="vditor-icon vditor-tooltipped vditor-tooltipped__n"
    >
      <svg><use xlink:href="#vditor-icon-insert-columnb"></use></svg></button
    ><button
      type="button"
      aria-label="在右边插入一列<${updateHotkeyTip('⇧⌘=')}>"
      data-type="insertColumnR"
      class="vditor-icon vditor-tooltipped vditor-tooltipped__n"
    >
      <svg><use xlink:href="#vditor-icon-insert-column"></use></svg></button
    ><button
      type="button"
      aria-label="删除行<${updateHotkeyTip('⌘-')}>"
      data-type="deleteRow"
      class="vditor-icon vditor-tooltipped vditor-tooltipped__n"
    >
      <svg><use xlink:href="#vditor-icon-delete-row"></use></svg></button
    ><button
      type="button"
      aria-label="删除列<${updateHotkeyTip('⇧⌘-')}>"
      data-type="deleteColumn"
      class="vditor-icon vditor-tooltipped vditor-tooltipped__n"
    >
      <svg><use xlink:href="#vditor-icon-delete-column"></use></svg></button
    >
  </div>
  `
    tablePanel = tablePanel.children[0]
    $(tablePanel).on('click', '.vditor-icon', (e) => {
      let type = $(e.target).attr('data-type')
      const handleMap = {
        left: [
          '{ctrl}{shift}l{/shift}{/ctrl}',
          '{meta}{shift}l{/shift}{/meta}',
        ],
        center: [
          '{ctrl}{shift}c{/shift}{/ctrl}',
          '{meta}{shift}c{/shift}{/meta}',
        ],
        right: [
          '{ctrl}{shift}r{/shift}{/ctrl}',
          '{meta}{shift}r{/shift}{/meta}',
        ],
        insertRowA: [
          '{ctrl}{shift}f{/shift}{/ctrl}',
          '{meta}{shift}f{/shift}{/meta}',
        ],
        insertRowB: ['{ctrl}={/ctrl}', '{meta}={/meta}'],
        deleteRow: ['{ctrl}-{/ctrl}', '{meta}-{/meta}'],
        insertColumnL: [
          '{ctrl}{shift}g{/shift}{/ctrl}',
          '{meta}{shift}g{/shift}{/meta}',
        ],
        insertColumnR: [
          '{ctrl}{shift}+{/shift}{/ctrl}',
          '{meta}{shift}={/shift}{/meta}',
        ],
        deleteColumn: [
          '{ctrl}{shift}_{/shift}{/ctrl}',
          '{meta}{shift}-{/shift}{/meta}',
        ], // 有的是+ 有的是=; -/_ 都是为了fix不同平 bug
      }
      let k =
        handleMap[type][
          navigator.platform.toLowerCase().includes('mac') ? 1 : 0
        ]
      disableVscodeHotkeys = true
      Promise.resolve(
        keyboard(k, {
          document: {
            body: vditor.vditor.ir.element,
          } as any,
        })
      ).finally(() => {
        disableVscodeHotkeys = false
      })
      e.stopPropagation()
    })
  }
  vditor.vditor.ir.element.addEventListener('click', (e) => {
    if (vditor.getCurrentMode() !== 'ir') return
    let clickEl = window.getSelection().anchorNode.parentElement
    if (!['TD', 'TH'].includes(clickEl.tagName)) {
      if (tablePanel.style.display !== 'none') {
        tablePanel.style.display = 'none'
      }
    } else if (tablePanel.style.display !== 'block') {
      tablePanel.style.display = 'block'
    }

    tablePanel.style.top =
      clickEl.getBoundingClientRect().top +
      (vditor.vditor.ir.element.scrollTop || window.scrollY) -
      25 +
      'px'
  })
  // don't bubble keyboardEvent to vscode when trigger vditor table hot keys, prevent hotkey conflicts with vscode
  let stopEvent = (e: KeyboardEvent) => {
    if (disableVscodeHotkeys) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
  vditor.vditor.ir.element.addEventListener('keydown', stopEvent)
  vditor.vditor.ir.element.addEventListener('keyup', stopEvent)
}
