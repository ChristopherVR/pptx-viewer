// `ooxmlDashToCssBorderStyle` is the framework-agnostic OOXML-dash -> CSS map;
// it lives in `pptx-viewer-shared` and is re-exported here so this module's
// public surface (and colocated tests) stay unchanged.
import { ooxmlDashToCssBorderStyle } from 'pptx-viewer-shared';

export { ooxmlDashToCssBorderStyle };

/**
 * Per-cell CSS from a parsed `a:tcPr`. The resolution (fills including gradients
 * and patterns, per-edge borders, insets, alignment, writing mode) is shared with
 * the other bindings; the values arrive as CSS strings, which React accepts
 * wherever it accepted the bare numbers this used to emit.
 */
export { cellStyleToCss } from 'pptx-viewer-shared';
