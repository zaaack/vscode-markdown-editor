# BEFORE Snapshot — Vditor Toolbar Tree-Shake Baseline

- Timestamp: 2026-05-28T00:38:32Z
- Git HEAD: e689d03e164862e678cd543a2f221a124a0a19a7

## 1. Bundle Sizes

| File | Bytes |
|---|---|
| media/dist/main.js | 417606 |
| media/dist/main.css | 59655 |
| out/extension.js | 21935 |

## 2. Test Suite

- Test Files: 10 passed (10)
- Tests: 119 passed (119)
- Duration: 553ms (transform 206ms, setup 0ms, collect 407ms, tests 48ms, environment 1.64s, prepare 722ms)
- Status: GREEN (119/119)
- Note: jsdom logs a benign "Not implemented: navigation" stderr line from utils.test.ts; not a failure.

## 3. Microbench Summary

| Suite | Bench | hz | mean (ms) |
|---|---|---:|---:|
| getAssetsFolder path computation | default config | 1,454,365.26 | 0.0007 |
| getAssetsFolder path computation | projectRoot template | 1,438,745.51 | 0.0007 |
| getAssetsFolder path computation | all template variables | 1,001,131.19 | 0.0010 |
| full document replace scaling | 100 lines - create Range + edit object | 31,669,557.87 | 0.0000 |
| full document replace scaling | 1000 lines - create Range + edit object | 31,629,137.18 | 0.0000 |
| full document replace scaling | 10000 lines - create Range + edit object | 30,238,368.67 | 0.0000 |
| base64 decode (upload simulation) | 1KB base64 decode | 3,325,903.33 | 0.0003 |
| base64 decode (upload simulation) | 100KB base64 decode | 59,092.69 | 0.0169 |
| base64 decode (upload simulation) | 1MB base64 decode | 8,700.11 | 0.1149 |
| upload path computation | path.relative for single file | 1,302,218.70 | 0.0008 |
| upload path computation | path.relative for 5 files (batch upload) | 270,451.62 | 0.0037 |
| option merging | deepMerge (current) | 2,910,271.83 | 0.0003 |
| option merging | structuredClone + Object.assign | 753,447.70 | 0.0013 |
| option merging | JSON parse/stringify + spread | 1,410,615.98 | 0.0007 |
| theme application | dark theme override | 32,308,985.68 | 0.0000 |
| theme application | light theme override | 31,316,713.93 | 0.0000 |
| upload filename generation | date format + sanitize (single file) | 2,661,393.58 | 0.0004 |
| upload filename generation | date format + sanitize (5 files batch) | 590,446.59 | 0.0017 |

### BENCH Summary (vitest ratios)

- getAssetsFolder: default config is fastest; 1.01x vs projectRoot; 1.45x vs all template variables.
- full document replace: 100 lines fastest; 1.00x vs 1000 lines; 1.05x vs 10000 lines.
- base64 decode: 1KB fastest; 56.28x vs 100KB; 382.28x vs 1MB.
- upload path computation: single file 4.81x vs 5-file batch.
- option merging: deepMerge fastest; 2.06x vs JSON parse/stringify; 3.86x vs structuredClone.
- theme application: dark 1.03x vs light.
- upload filename generation: single file 4.51x vs 5-file batch.

## 4. Build Times (3 runs)

### esbuild (media-src bundle)

| Run | esbuild self-reported | wall-clock (real) |
|---|---|---|
| 1 | 23ms | 0.650s |
| 2 | 614ms | 0.966s |
| 3 | 626ms | 0.970s |

- Median esbuild self-reported: 614ms
- Median wall-clock: 0.966s
- Run 1 wall-clock 0.650s is an outlier (cold/warm npx cache + fast esbuild internal timing 23ms).

### tsc --noEmit

| Run | wall-clock (real) |
|---|---|
| 1 | 0.780s |
| 2 | 0.724s |
| 3 | 0.734s |

- Median wall-clock: 0.734s

## 5. Toolbar Inventory

### Bare-string Vditor built-ins (top-level)

- emoji
- headings
- bold
- italic
- strike
- link
- list
- ordered-list
- check
- outdent
- indent
- quote
- line
- code
- inline-code
- insert-before
- insert-after
- upload
- table
- undo
- redo

Top-level separators (`'|'`): 7

### Bare-string Vditor built-ins (inside "more" submenu)

- both
- code-theme
- content-theme
- preview
- devtools
- info
- help

### Custom (named-object) buttons

Top-level:
- save (⌘s, custom click → postMessage 'save')
- find (⌘F tip, custom click → postMessage 'find')
- outline (no click; SVG icon only)
- edit-mode (tipPosition only)
- more (container; nests submenu below)

Inside "more" submenu:
- copy-markdown (clipboard write of vditor.getValue())
- copy-html (clipboard write of vditor.getHTML())
- reset-config (confirm → postMessage 'reset-config')

### Totals

- Bare built-ins (top-level): 21
- Bare built-ins (inside "more"): 7
- Bare built-ins total: 28
- Custom buttons (top-level): 5
- Custom buttons (in "more"): 3
- Custom buttons total: 8
- Separators (top-level): 7
