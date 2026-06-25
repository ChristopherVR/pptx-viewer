/**
 * Resolved shape clip-path helper (thin re-export shim).
 *
 * The preset clip-path cascade (adjustment-aware -> ECMA-376 preset evaluator
 * -> cloud Bezier -> core's static `getShapeClipPath` table) is implemented
 * once in `pptx-viewer-shared` (`render/shape-geometry.ts`) and shared by every
 * binding. This module re-exports the shared implementation under the names the
 * React viewer's clipping pipeline already consumes, so existing imports keep
 * working without a local duplicate.
 */
export { getResolvedShapeClipPath, getResolvedShapeClipPathFor } from 'pptx-viewer-shared';
