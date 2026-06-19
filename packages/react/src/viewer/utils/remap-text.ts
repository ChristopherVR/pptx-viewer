/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * The rich-text remap logic was consolidated into `pptx-viewer-shared`
 * (`render/remap-text.ts`), shared by every binding. This shim preserves the
 * historical React import surface.
 */
export { remapTextToSegments } from 'pptx-viewer-shared';
