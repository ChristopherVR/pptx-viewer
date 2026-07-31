/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Ruler tick generation + constants were consolidated into
 * `pptx-viewer-shared` (`render/ruler`). This shim preserves the historical
 * Vue import surface so `RulerStrips.vue` / `SlideCanvas.vue` and the colocated
 * test are unchanged. The components render the generated ticks.
 */

export {
	generateTicks,
	PX_PER_INCH,
	PX_PER_CM,
	RULER_THICKNESS,
	RULER_FONT_SIZE,
	rulerDragToGuidePosition,
} from 'pptx-viewer-shared';

export type { RulerUnit, Tick } from 'pptx-viewer-shared';
