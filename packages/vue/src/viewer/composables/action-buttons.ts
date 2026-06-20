/**
 * Thin re-export shim → `pptx-viewer-shared` (`render/action-buttons`).
 *
 * The OOXML action-button catalogue + element factory now live in shared,
 * consumed by every binding. This file preserves the historical Vue import
 * surface so the Insert > Action wiring and the colocated tests are unchanged.
 */

export { isActionButton, buildActionButtonElement } from 'pptx-viewer-shared';
