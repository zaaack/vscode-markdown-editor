let vditor
const vscode = window.acquireVsCodeApi && acquireVsCodeApi()

const Langs = {
  en_US: {
    save: 'Save',
  },
  ja_JP: {
    save: '保存する',
  },
  ko_KR: {
    save: '저장',
  },
  zh_CN: {
    save: '保存',
  },
}
const lang = (() => {
  let l = navigator.language.replace('-', '_')
  if (!Langs[l]) {
    l = 'en_US'
  }
  return l
})()

const toolbar = [
  {
    hotkey: '⌘s',
    name: 'save',
    tipPosition: 's',
    tip: Langs[lang].save,
    className: 'save',
    icon:
      '<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M810.667 938.667H213.333a128 128 0 01-128-128V213.333a128 128 0 01128-128h469.334a42.667 42.667 0 0130.293 12.374L926.293 311.04a42.667 42.667 0 0112.374 30.293v469.334a128 128 0 01-128 128zm-597.334-768a42.667 42.667 0 00-42.666 42.666v597.334a42.667 42.667 0 0042.666 42.666h597.334a42.667 42.667 0 0042.666-42.666v-451.84l-188.16-188.16z"/><path d="M725.333 938.667A42.667 42.667 0 01682.667 896V597.333H341.333V896A42.667 42.667 0 01256 896V554.667A42.667 42.667 0 01298.667 512h426.666A42.667 42.667 0 01768 554.667V896a42.667 42.667 0 01-42.667 42.667zM640 384H298.667A42.667 42.667 0 01256 341.333V128a42.667 42.667 0 0185.333 0v170.667H640A42.667 42.667 0 01640 384z"/></svg>',
    click() {
      vscode.postMessage({
        command: 'save',
        content: vditor.getValue(),
      })
    },
  },

  'emoji',
  'headings',
  'bold',
  'italic',
  'strike',
  'link',
  '|',
  'list',
  'ordered-list',
  'check',
  'outdent',
  'indent',
  '|',
  'quote',
  'line',
  'code',
  'inline-code',
  'insert-before',
  'insert-after',
  '|',
  'upload',
  'table',
  '|',
  'undo',
  'redo',
  '|',
  'fullscreen',
  'edit-mode',
  {
    name: 'more',
    toolbar: [
      'both',
      'code-theme',
      'content-theme',
      {
        name: 'copy-markdown',
        icon: '复制 markdown',
        click() {
          navigator.clipboard.writeText(vditor.getValue())
          vscode.postMessage({
            command: 'info',
            content: '复制 markdown 成功'
          })
        },
      },
      {
        name: 'copy-html',
        icon: '复制 html',
        click() {
          navigator.clipboard.writeText(vditor.getHTML())
          vscode.postMessage({
            command: 'info',
            content: '复制 html 成功'
          })
        },
      },
      'outline',
      'preview',
      'devtools',
      'info',
      'help',
    ],
  },
].map((it) => {
  if (typeof it === 'string') {
    it = { name: it }
  }
  it.tipPosition = 's'
  return it
})

function fixDarkTheme() {
  let $ct = document.querySelector('[data-type="content-theme"]')
  $ct.nextElementSibling.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return
    let type = e.target.getAttribute('data-type')
    if (type === 'dark') {
      vditor.setTheme(type)
    } else {
      vditor.setTheme('classic')
    }
  })
}

function fixPanelHover() {
  $('.vditor-panel').each((i, e) => {
    let timer
    $(e).on('mouseenter', (e) => {
      timer && clearTimeout(timer)
      e.currentTarget.classList.add('vditor-panel_hover')
    }).on('mouseleave', e => {
      let el = e.currentTarget
      timer = setTimeout(() => {
        el.classList.remove('vditor-panel_hover')
      }, 2000)
    })
  })
}

const fileToBase64 = async (file) => {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = function (evt) {
      res(evt.target.result.split(',')[1])
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

function saveVditorOptions() {
  let vditorOptions = {
    theme: vditor.vditor.options.theme,
    mode: vditor.vditor.currentMode,
    preview: vditor.vditor.options.preview
  }
  vscode.postMessage({
    command: 'save-options',
    options: vditorOptions
  })
}

function handleToolbarClick() {
  $('.vditor-toolbar .vditor-panel--left button, .vditor-toolbar .vditor-panel--arrow button').on('click', e => {
    setTimeout(() => {
      saveVditorOptions()
    }, 500)
  })
}

function initVditor(value = '', options = {}) {
  console.log('options', options)
  let inputTimer
  vditor = new Vditor('vditor', {
    width: '100%',
    height: '100%',
    minHeight: '100%',
    lang: lang,
    value,
    theme: 'dark',
    mode: 'wysiwyg',
    cache: { enable: false },
    toolbar,
    toolbarConfig: { pin: true },
    ...options,
    after() {
      fixDarkTheme()
      fixPanelHover()
      handleToolbarClick()
    },
    input() {

      inputTimer && clearTimeout(inputTimer)
      inputTimer = setTimeout(() => {
        vscode.postMessage({ command: 'edit', content: vditor.getValue() })
      }, 500)
    },
    upload: {
      url: '/fuzzy', // 没有 url 参数粘贴图片无法上传 see: https://github.com/Vanessa219/vditor/blob/d7628a0a7cfe5d28b055469bf06fb0ba5cfaa1b2/src/ts/util/fixBrowserBehavior.ts#L1409
      async handler(files) {
        console.log('files', files)
        let fileInfos = await Promise.all(
          files.map(async (f) => {
            return {
              base64: await fileToBase64(f),
              name: `${Math.random().toString(36).slice(2)}_${
                f.name
              }`.replace(/[^\w_]+/, '_'),
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
  switch (msg.command) {
    case 'update': {
      if (!vditor) {
        try {
          initVditor(msg.content, msg.options)
        } catch (error) {
          // reset options when error
          console.error(error)
          initVditor(msg.content)
          saveVditorOptions()
        }
        console.log('initVditor')
      } else {
        vditor.setValue(msg.content)
        console.log('setValue')
      }
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

vscode.postMessage({ command: 'ready' })
