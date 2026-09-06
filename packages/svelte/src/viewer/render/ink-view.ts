/**
 * View-model builder for Draw-tab `InkPptxElement` strokes.
 *
 * The pressure-circle decision used to be hand-rolled here (a near-exact copy
 * of Vue's and vanilla's own hand-rolled versions, with no tilt/nib support at
 * all), which meant a real pen-tilt reading never rendered a calligraphic
 * lean for the Draw tool's own strokes even though a loaded `p:contentPart`'s
 * tilt already did (see `contentpart-view.ts`). It now delegates to
 * `pptx-viewer-shared`'s `buildInkGroupStrokes`, the exact same decision
 * function `ContentPartView.svelte` uses for a loaded content part; this
 * module only adds the per-stroke presentation-replay style, which is
 * Svelte's own concern (each binding wires replay differently).
 */
import type { InkPptxElement } from 'pptx-viewer-core';
import type { InkGroupStrokeView, InkStrokeAnimationStyle } from 'pptx-viewer-shared';
import {
	buildInkGroupStrokes,
	DEFAULT_STROKE_COLOR,
	getInkReplayStyles,
	inkGroupViewBox,
} from 'pptx-viewer-shared';

/** One rendered ink stroke: a constant-width path, pressure circles, or tilt nib marks. */
export interface InkStrokeView extends InkGroupStrokeView {
	/** Sequential reveal style, enabled only while presenting; `null` otherwise. */
	replay: InkStrokeAnimationStyle | null;
}

/** SVG `viewBox` for the ink element's bounding box (min 1x1). */
export const inkViewBox = inkGroupViewBox;

/** Project the element's parallel ink arrays into per-stroke view models. */
export function buildInkStrokes(element: InkPptxElement, replay = false): InkStrokeView[] {
	const replayStyles = replay ? getInkReplayStyles(element) : [];
	return buildInkGroupStrokes(element, { color: DEFAULT_STROKE_COLOR, width: 1 }).map(
		(stroke, i) => ({
			...stroke,
			replay: replayStyles[i] ?? null,
		}),
	);
}
