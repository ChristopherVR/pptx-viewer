/**
 * Thin re-export shim → `pptx-viewer-shared` (`render/alignment-guides`).
 *
 * The draggable H/V alignment-guide CRUD helpers now live in shared, consumed
 * by every binding. This file preserves the historical Vue import surface so
 * `ViewerCanvasArea` / the guide dialogs and the colocated tests are unchanged.
 */

export type { Guide } from 'pptx-viewer-shared';
export { createGuide, moveGuide, removeGuide } from 'pptx-viewer-shared';
