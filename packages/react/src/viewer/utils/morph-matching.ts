/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Morph element matching (`!!` naming / id / proximity passes) now lives in
 * `pptx-viewer-shared` (`render/morph-matching`).
 *
 * @module utils/morph-matching
 */
export {
	getElementMorphName,
	matchMorphElements,
	matchMorphElementsFull,
} from 'pptx-viewer-shared';
