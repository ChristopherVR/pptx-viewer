/**
 * Thin re-export shim → `pptx-viewer-shared` (`render/smart-art-presets`).
 *
 * The SmartArt insert-gallery catalogue (presets + categories) now lives in
 * shared, consumed by every binding. This file preserves the historical Vue
 * import surface so `SmartArtPreviews.vue` / `InsertSmartArtDialog.vue` and the
 * colocated tests are unchanged.
 */

export type { SmartArtCategory, SmartArtPreset } from 'pptx-viewer-shared';
export { PRESETS, CATEGORIES } from 'pptx-viewer-shared';
