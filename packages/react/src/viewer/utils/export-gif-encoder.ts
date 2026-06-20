/**
 * Animated-GIF encoder: thin re-export shim.
 *
 * The pure GIF89a byte encoder (median-cut quantisation + LZW) now lives once
 * in `pptx-viewer-shared` (`export/gif-encoder`). This module preserves the
 * historical `encodeGif` import path for React consumers/tests.
 */
export { encodeGif } from 'pptx-viewer-shared';
export type { EncodeGifOptions, GifFrame } from 'pptx-viewer-shared';
