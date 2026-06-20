/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure mobile-chrome sheet state machine was extracted to
 * `pptx-viewer-shared` (`render/mobile-chrome.ts`) and is consumed by every
 * binding. This shim preserves the historical Angular import surface so the
 * mobile chrome components and the colocated tests are unchanged.
 */
export type { MobileSheetKey, ActionDescriptor } from '../internal/shared';
export { toggleSheet, buildBarActions, sheetAfterNavigate } from '../internal/shared';
