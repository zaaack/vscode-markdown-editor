// Custom esbuild driver for the webview bundle.
//
// Replaces the previous one-liner esbuild CLI invocation in package.json
// scripts. The extra capability we need is an `onResolve` plugin that
// stubs out Vditor toolbar button modules our config never references,
// so esbuild stops including them in the bundle. See
// src/stubs/vditor-toolbar-stubs.ts for the rationale.

import * as esbuild from 'esbuild'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
