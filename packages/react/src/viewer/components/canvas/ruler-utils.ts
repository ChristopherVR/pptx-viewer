/**
 * Thin re-export shim → `pptx-viewer-shared`.
 *
 * Ruler tick generation + constants were consolidated into
 * `pptx-viewer-shared` (`render/ruler`). This shim preserves the historical
 * React import surface so `Ruler.tsx`, `RulerStrips.tsx`, `SlideCanvas.tsx`,
 * `canvas-types`, `slide-canvas-types`, and the colocated test are unchanged.
 */

export {
	generateTicks,
	PX_PER_INCH,
	PX_PER_CM,
	RULER_THICKNESS,
	RULER_FONT_SIZE,
} from 'pptx-viewer-shared';

export type { RulerUnit, Tick } from 'pptx-viewer-shared';
