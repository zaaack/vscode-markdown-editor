# Markdown Editor — A full-featured WYSIWYG editor for markdown

[![](https://vsmarketplacebadge.apphb.com/version-short/zaaack.markdown-editor.svg)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor) [![](https://vsmarketplacebadge.apphb.com/installs-short/zaaack.markdown-editor.svg)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor) [![](https://vsmarketplacebadge.apphb.com/downloads-short/zaaack.markdown-editor.svg)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor) [![](https://vsmarketplacebadge.apphb.com/rating-short/zaaack.markdown-editor.svg)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor)

## Demo

![demo](./demo.gif)

## Features

* What You See Is What You Get (WYSIWYG)
* Auto sync changes between the VSCode editor and webview
* Copy markdown/html
* Uploaded/pasted/drag-dropped images will be auto-saved to the `assets` folder
* Multi-theme support
* Shortcut keys
* Multiple editting modes: instant Rendering mode (**Recommended!**) / WYSIWYG mode / split screen mode
* Markdown extensions
* Multiple graph support including KaTeX / Mermaid / Graphviz / ECharts / abc.js(notation) / ...
* For more usage please see [vditor](https://github.com/Vanessa219/vditor)

## Install

[https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor)

## Supported syntax

[demo article](https://ld246.com/guide/markdown)

## Usage

This plugin auto-associates itself with markdown (.md, .markdown) file format. If you have the plugin installed, and open a markdown file - it will automatically use this plugin to edit it.

If you prefer to switch between the VSCode default editor and this plugin, you can do so by:

1. Use `Ctrl+shift+p` (or `Cmd+shift+p` on mac) to bring up the command pallete
2. Search and activate `View: Reopen Editor with...`

VSCode will provide a menu with all available editors for current file format, including Text which is the default editor.

## Acknowledgement

* [vscode](https://github.com/microsoft/vscode)
* [vditor](https://github.com/Vanessa219/vditor)

## Todo

* [X] Using [Custom Text Editor](https://code.visualstudio.com/api/extension-guides/custom-editors#custom-text-editor) ([demo](https://github.com/gera2ld/markmap-vscode))

## Caveats

This editor uses a custom webview based editor instead of VSCode's default monaco editor.

So any plugins and customizations that target VSCode's editor (eg. Vim keybindings, LSP autocompletion support etc.) will not be available in markdown editor.

## License

MIT

## Support

If you like this extension make sure to star the repo. I am always looking for new ideas and feedback.
In addition, it is possible to [donate via paypal](https://www.paypal.me/zaaack).


[Test](./Test.md)
