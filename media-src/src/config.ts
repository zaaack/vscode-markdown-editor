// Shared compile-time configuration for the webview bundle.
// Kept in its own module so test files can import it without dragging
// in Vditor or the rest of main.ts's side effects.

// Coalesce per-keystroke edits before round-tripping to the extension host.
// 250 ms is below the ~300 ms threshold where typists perceive lag and
// roughly halves the edit-message chatter compared to the original 100 ms.
export const EDIT_DEBOUNCE_MS = 250
