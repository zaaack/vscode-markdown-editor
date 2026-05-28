// Empty stubs for Vditor toolbar buttons our config never references.
//
// Vditor's toolbar/index.ts top-level imports every button class and
// dispatches in a switch by `menuItem.name`. The case branches for
// 'br', 'fullscreen', 'record', and 'export' are unreachable for us:
// none of those strings appear in media-src/src/toolbar.ts. But because
// the imports are unconditional and the case branches contain live
// `new ClassName(...)` references, esbuild can't dead-code-eliminate
// the modules on its own.
//
// build.mjs intercepts the four imports via an onResolve plugin and
// redirects them all to this file. Each stub class exposes the
// minimum interface Vditor checks downstream (.element), but the
// real implementations (~250 LOC + the PDF/HTML export utilities
// in Vditor's export/ subtree) drop out of the bundle.

class StubElement {
  public element = document.createElement('div')
}

export class Br extends StubElement {}
export class Fullscreen extends StubElement {}
// `Record` shadows the global TypeScript Record<K,V> name in this module
// scope, which is fine — Vditor's source does the same thing.
export class Record extends StubElement {}
export class Export extends StubElement {}
