// Custom esbuild driver for the webview bundle.
//
// Replaces the previous one-liner esbuild CLI invocation in package.json
// scripts. The extra capability we need is an `onResolve` plugin that
// stubs out Vditor toolbar button modules our config never references,
// so esbuild stops including them in the bundle. See
// src/stubs/vditor-toolbar-stubs.ts for the rationale.

import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Vditor declares `VDITOR_VERSION` as an ambient const in its TS sources
// (vditor/src/ts/constants.ts:1) and relies on its bundler (webpack
// DefinePlugin) to substitute the actual version string at build time.
// Now that we consume Vditor via source-import instead of its
// pre-bundled UMD, we have to perform the same substitution ourselves —
// otherwise the reference becomes a `ReferenceError: VDITOR_VERSION is
// not defined` at first paint and the entire webview stays blank.
const vditorPkg = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, 'node_modules/vditor/package.json'),
    'utf8'
  )
)

const args = new Set(process.argv.slice(2))
const watch = args.has('--watch')
// --no-minify is convenient for inspecting bundle output during dev.
const minify = !args.has('--no-minify') && !watch

const stubPath = path.resolve(
  __dirname,
  'src/stubs/vditor-toolbar-stubs.ts'
)

// Match the four button source files inside Vditor's TS sources. The
// regex tolerates both extension-less imports (Vditor uses `from "./Br"`
// etc.) and the resolved `.ts` path esbuild produces during traversal.
const unusedVditorToolbarButtons =
  /[\\/]vditor[\\/]src[\\/]ts[\\/]toolbar[\\/](Br|Fullscreen|Record|Export)(\.ts)?$/

const stubUnusedVditorButtons = {
  name: 'stub-unused-vditor-buttons',
  setup(build) {
    build.onResolve({ filter: unusedVditorToolbarButtons }, () => ({
      path: stubPath,
    }))
  },
}

const config = {
  entryPoints: ['./src/main.ts'],
  bundle: true,
  minify,
  sourcemap: true,
  outfile: '../media/dist/main.js',
  define: {
    VDITOR_VERSION: JSON.stringify(vditorPkg.version),
  },
  // Vditor's TS uses the legacy class-field semantics: subclasses
  // (Emoji, Both, EditMode, …) declare `public element: HTMLElement;`
  // without an initializer, then rely on `super()` to populate it
  // before the subclass body uses `this.element`. esbuild's default
  // (useDefineForClassFields=true, equivalent to `Object.defineProperty`)
  // re-defines the field on the instance to `undefined` AFTER super
  // returns — which then crashes with
  //   "Cannot read properties of undefined (reading 'appendChild')"
  // in MenuItem.ts:34.
  // Telling esbuild to use TS's legacy assignment semantics matches
  // Vditor's own webpack/tsc build output.
  tsconfigRaw: {
    compilerOptions: {
      useDefineForClassFields: false,
    },
  },
  plugins: [stubUnusedVditorButtons],
  logLevel: 'info',
}

if (watch) {
  const ctx = await esbuild.context(config)
  await ctx.watch()
  console.log('[build.mjs] watching for changes…')
} else {
  await esbuild.build(config)
}
