/**
 * Thin re-export shim -> `pptx-viewer-shared` (`render/cross-slide-audio`).
 *
 * Cross-slide ("play across slides") audio registration now lives in shared,
 * consumed by every binding. This file preserves the historical Vue import
 * surface (`../composables/cross-slide-audio`) so `ElementMediaBox.vue` and
 * its colocated tests are unchanged.
 */
export { registerCrossSlideAudio } from 'pptx-viewer-shared';
