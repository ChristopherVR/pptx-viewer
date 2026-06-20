/**
 * Thin re-export shim -> `pptx-viewer-shared`.
 *
 * The pure stroke/dash normalisation, compound-line box-shadow generation, SVG
 * dasharray computation, element transform strings, and drawing-unit parsing
 * were extracted to `pptx-viewer-shared` (`render/element-style-transform`) and
 * are consumed by every binding. This shim preserves the historical React
 * import surface so the many `viewer/utils/*` consumers and the colocated tests
 * are unchanged. The React-only presentation-transition style helper stays
 * local and is re-exported here.
 */
export { getPresentationTransitionStyle } from './style-transitions';

export type { CssBorderStyle, CssStyleMap } from 'pptx-viewer-shared';
export {
	normalizeStrokeDashType,
	getCssBorderDashStyle,
	getCompoundLineBoxShadow,
	getCompoundLineBorderWidth,
	getCompoundLineStyle,
	getSvgStrokeDasharray,
	getElementTransform,
	getElementTransformWithoutRotation,
	getTextCompensationTransform,
	parseDrawingPercent,
} from 'pptx-viewer-shared';
