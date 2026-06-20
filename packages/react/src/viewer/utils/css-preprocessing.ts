/**
 * CSS preprocessing for print/export fidelity: thin re-export shim.
 *
 * The pure DOM passes (custom-property resolution, backdrop-filter / mix-blend-
 * mode / 3D-transform flattening, unsupported-feature removal, combined
 * `preprocessCssForCapture`) now live once in `pptx-viewer-shared`
 * (`export/css-preprocessing`). This module preserves the historical import
 * path for the React export pipeline and its tests.
 */
export {
	preprocessCssForCapture,
	resolveCustomProperties,
	flattenBackdropFilter,
	flattenMixBlendMode,
	flatten3dTransform,
	flatten3dTransforms,
	has3dTransform,
	parseBlurValue,
	removeUnsupportedFeatures,
} from 'pptx-viewer-shared';
export type { CssPreprocessingOptions } from 'pptx-viewer-shared';
