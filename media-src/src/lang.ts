const Langs = {
  en_US: {
    save: 'Save',
    copyMarkdown: 'Copy Markdown',
    copyHtml: 'Copy HTML',
    resetConfig: 'Reset config',
    resetConfirm: "Are you sure to reset the markdown-editor's config?",
  },
  ja_JP: {
    save: '保存する',
  },
  ko_KR: {
    save: '저장',
  },
  zh_CN: {
    save: '保存',
    copyMarkdown: '复制 Markdown',
    copyHtml: '复制 HTML',
    resetConfig: '重置配置',
    resetConfirm: '确定要重置 markdown-editor 的配置么?',
  },
}

export const lang = (() => {
  let l: any = navigator.language.replace('-', '_')
  if (!Langs[l]) {
    l = 'en_US'
  }
  return l
})()

export function t(msg: string) {
  return (Langs[lang] && Langs[lang][msg]) || Langs.en_US[msg]
}
