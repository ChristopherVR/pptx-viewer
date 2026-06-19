/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The format-painter copy/apply logic was consolidated into
 * `pptx-viewer-shared` (`render/format-painter.ts`), shared by every binding.
 * This shim preserves the historical Vue import surface so `FormatPanel.vue`
 * and the colocated tests keep importing the same names unchanged.
 */
export type { CopiedFormat } from 'pptx-viewer-shared';
export { copyFormatFromElement, applyFormatToElement, hasCopyableFormat } from 'pptx-viewer-shared';
