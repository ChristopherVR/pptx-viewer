/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure freehand-ink helpers were extracted to `pptx-viewer-shared`
 * (`render/ink-drawing.ts`) and are consumed by every binding. This shim
 * preserves the historical Angular import surface so the ink overlay and the
 * colocated tests are unchanged.
 */
export type { InkPoint, InkStrokeView, StrokeToInkElementOpts } from '../internal/shared';
export {
	buildLiveInkStrokeView,
	pointFromPointerEvent,
	pointsToSvgPathD,
	strokeToInkElement,
} from '../internal/shared';
