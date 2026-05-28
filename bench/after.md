# After: Vditor toolbar tree-shake + source-import

Captured: 2026-05-28
Git HEAD: see commit immediately following this file
Change: switched `import Vditor from 'vditor'` → `'vditor/src/index'`, added an esbuild plugin in `media-src/build.mjs` that stubs `Br`, `Fullscreen`, `Record`, `Export` button modules (none referenced by our toolbar config).

## Bundle sizes (vs `bench/before.md`)

| Asset                | Before (bytes) |  After (bytes) |     Δ |        Δ% |
| -------------------- | -------------: | -------------: | ----: | --------: |
| `media/dist/main.js` |        417,606 |        375,165 | −42,441 | **−10.2%** |
| `media/dist/main.css` |         59,655 |         59,655 |     0 |       0%  |
| `out/extension.js`   |         21,935 |         21,935 |     0 |       0%  |

JS bundle dropped **41.4 KiB** (407.8 → 366.4 KiB). The win is larger than the agent's "5 KB ± 3 KB toolbar-only" estimate because the dominant contributor is the source-import switch: esbuild now re-minifies the entire Vditor graph under our minify settings instead of consuming the pre-minified UMD blob from `vditor/dist/index.min.js`.

CSS bundle is unchanged because we still consume Vditor's `dist/index.css`.

## Test suite

- **119 / 119 tests passing**, 10 files. Suite duration ~600 ms (unchanged from before).
- `test/perf/bundle-size.test.ts` still passes with the lower bundle.

## Microbenches

All benches run cleanly. No regressions; numbers within sampling noise of the before baseline:

- `deepMerge (current)` — 2.36× faster than JSON-clone, 4.48× faster than structuredClone (before: 2.91×, 3.89× respectively — small variance, same ordering).
- Full-doc replace at 100 / 1 000 / 10 000 lines all ~30 M hz (constant w.r.t. doc size, unchanged).
- 1 KB base64 decode 54.6× faster than 100 KB, 407× faster than 1 MB (matches before within noise).
- Upload path computation, theme application, getAssetsFolder: all within ±5% of before.

No microbench shifted meaningfully — the change is bundle-size only, the hot paths run the same code.

## Cumulative bundle history

| Version | `main.js` minified |     Δ vs prev |          Δ vs original (805 KB) |
| ------- | -----------------: | ------------: | ------------------------------: |
| Original upstream     |       ~805 KB |             — |                            — |
| Better Markdown Editor (post commit `3a34319`) |    407.8 KiB |       **−49%** |                  −49% |
| After this change                              |    366.4 KiB | **−10.2%** |                **−55%**       |

## Risk register

- **Vditor TS source import**: build now compiles Vditor's TS under our esbuild instead of consuming the pre-bundled UMD. If Vditor's source ever starts using TS features esbuild can't handle (decorators with `experimentalDecorators`, namespace merging, etc.), the build will break. Currently clean — no decorators present in Vditor 3.8.4 source.
- **Stub modules**: the 4 stubbed buttons (`Br`, `Fullscreen`, `Record`, `Export`) export class shells with only a `.element` property. If Vditor's switch dispatch ever changes to reach these `case` branches for our config, we'd see runtime errors. Currently safe — our toolbar config never references those names. The 119 tests including the toolbar-shape test cover this.
- **Sourcemap size**: jumped from 1.1 MB to 1.4 MB (sourcemaps include the unminified Vditor source now). Doesn't ship in the `.vsix` (excluded by `.vscodeignore`), so no install-size impact.

## Future-unlocked

The source-import switch is the load-bearing change. Same alias trick can now stub:
- Unused editor modes (`sv/`, possibly drop one mode entirely) — agent estimated 20–60 KB.
- The `export/` subtree (already partially stubbed via `Export.ts`).
- Specific markdown render features if any go unused.
