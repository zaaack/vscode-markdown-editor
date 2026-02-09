# Markdown Editor — A full-featured WYSIWYG editor for markdown

[![badge_title](https://vsmarketplacebadges.dev/version-short/zaaack.markdown-editor.svg)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor) [![](https://vsmarketplacebadges.dev/installs-short/zaaack.markdown-editor.svg)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor) [![](https://vsmarketplacebadges.dev/rating-short/zaaack.markdown-editor.svg)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor)

## Demo

![demo](./demo.gif)

## Features

1. What You See Is What You Get (WYSIWYG)
2. Auto sync changes between the VSCode editor and webview
3. Copy markdown/html
4. Uploaded/pasted/drag-dropped images will be auto-saved to the `assets` folder
5. Multi-theme support
6. Shortcut keys
7. Multiple editti[](https://)ng modes: instant Rendering mode (**Recommand!**) / WYSIWYG mode / split screen mode
8. Markdown extensions
9. Multiple graph support including KaTeX / Mermaid / Graphviz / ECharts / abc.js(notatioan) / ...
10. For more usage please see [vditor](https://github.com/Vanessa219/vditor)

## Install

[https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor)

## Supported syntax

[demo article](https://ld246.com/guide/markdown)

## Usage

### 1. Command mode in markdown file

- open a markdown file
- type `cmd-shift-p` to enter command mode
- type `markdown-editor: Open with markdown editor`

### 2. Key bindings

- open a markdown file
- type `ctrl+shift+alt+m` for win or `cmd+shift+alt+m` for mac

### 3. Explorer Context menu

- right click on markdown file
- then click `Open with markdown editor`

### 4. Editor title context menu

- right click on a opened markdown file's tab title
- then click `Open with markdown editor`

### 5. Open With... and Set Default Editor

- right click on a markdown file in Explorer
- click `Open With...`
- select `Markdown Editor` to open temporary
- or click `Configure default editor...` and select `Markdown Editor` to set it as default

### Custom CSS (custom layout and vditor personalization)

Edit your settings.json and add

```
"markdown-editor.customCss": "my custom css rules"

// Eg: "markdown-editor.customCss": ".vditor-ir pre.vditor-reset {line-height: 32px;padding-right: calc(100% - 800px) !important; margin-left: 100px;    font-family: system-ui !important;}"
```

## Acknowledgement

- [vscode](https://github.com/microsoft/vscode)
- [vditor](https://github.com/Vanessa219/vditor)


## Todo

- [ ] Using [Custom Text Editor](https://code.visualstudio.com/api/extension-guides/custom-editors#custom-text-editor) ([demo](https://github.com/gera2ld/markmap-vscode))

## License

MIT

## Support

If you like this extension make sure to star the repo. I am always looking for new ideas and feedback. In addition, it is possible to [donate via paypal](https://www.paypal.me/zaaack).
