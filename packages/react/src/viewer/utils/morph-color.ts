/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Morph colour parsing/interpolation now lives in `pptx-viewer-shared`
 * (`render/morph-color`).
 *
 * @module utils/morph-color
 */
export { parseHexColor, lerpColor, rgbaToHex } from 'pptx-viewer-shared';
