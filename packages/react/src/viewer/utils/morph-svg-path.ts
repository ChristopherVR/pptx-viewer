/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Morph SVG-path parse/serialize/equalize/interpolate now lives in
 * `pptx-viewer-shared` (`render/morph-svg-path`).
 *
 * @module utils/morph-svg-path
 */
export {
	parseSvgPath,
	serializeSvgPath,
	equalizePaths,
	interpolatePaths,
} from 'pptx-viewer-shared';
