/**
 * Animated-GIF encoder: thin re-export shim.
 *
 * The pure GIF89a byte encoder (median-cut colour quantisation + LZW) now lives
 * once in `pptx-viewer-shared` (`export/gif-encoder`). This module preserves the
 * historical `./gif-encoder` import path so `useMediaExport` can keep
 * lazy-loading it via dynamic `import()` (keeping the encoder out of the main
 * viewer chunk) and tests can keep importing the `GifFrame` type unchanged.
 */
export { encodeGif } from 'pptx-viewer-shared';
export type { GifFrame } from 'pptx-viewer-shared';
