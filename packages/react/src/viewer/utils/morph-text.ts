/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Morph text tokenisation/matching now lives in `pptx-viewer-shared`
 * (`render/morph-text`).
 *
 * @module utils/morph-text
 */
export { tokenizeText, matchTextTokens } from 'pptx-viewer-shared';
