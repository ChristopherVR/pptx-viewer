/**
 * GIF export helpers for the Angular viewer — thin re-export shim.
 *
 * The pure GIF89a byte encoder (median-cut quantisation + LZW) and the
 * browser-free planning helpers (frame ordering, per-frame delay, dimension
 * clamping) now live once in `pptx-viewer-shared` (`export/gif-encoder`),
 * vendored into this library via `../internal/shared`. This module preserves
 * the historical `./gif-export-helpers` import path for the ExportService,
 * the public `index.ts` barrel, and the colocated tests.
 *
 * The caller (ExportService) still owns rasterisation: rendering slides to
 * canvases and extracting `ImageData` via `ctx.getImageData()`.
 */
export { planGifFrames, msToFrameDelayCs, clampGifDimensions, encodeGif } from '../internal/shared';
export type { GifFramePlan, GifPlanOptions, GifFrame, EncodeGifOptions } from '../internal/shared';
