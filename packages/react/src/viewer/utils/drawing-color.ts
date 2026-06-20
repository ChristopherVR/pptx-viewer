/**
 * Thin re-export shim -> `pptx-viewer-shared`.
 *
 * OOXML drawing-colour resolution (colour-choice parsing, the 26 colour
 * transforms, scheme inheritance, alpha resolution) was extracted to
 * `pptx-viewer-shared` (`render/drawing-color`) and is consumed by every
 * binding. This shim preserves the historical React import surface so the
 * `viewer/utils/*` consumers and the colocated test are unchanged.
 */
export {
	DEFAULT_SCHEME_COLOR_MAP,
	applyDrawingColorTransforms,
	parseDrawingColorChoice,
	parseDrawingColor,
	parseDrawingColorOpacity,
} from 'pptx-viewer-shared';
