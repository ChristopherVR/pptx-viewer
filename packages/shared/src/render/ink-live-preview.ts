/**
 * Live (in-progress) stroke preview for the Draw tool, shared by every
 * binding.
 *
 * Before this module, every binding's Draw overlay built its own live-preview
 * polyline `d` directly from the accumulated point list and stopped there: a
 * calligraphic pen-tilt lean or a pressure-variable width only ever appeared
 * once `pointerup` committed the stroke as an `InkPptxElement` and it
 * round-tripped through {@link buildInkGroupStrokes}. This function is the
 * "pointer still down" twin of that: given the SAME accumulated `InkPoint[]`
 * (with per-point pressure/tilt already attached by
 * {@link pointFromPointerEvent}), it makes the SAME render-mode decision
 * ({@link buildInkStrokeView}) a just-committed stroke would get, so a
 * calligraphic-nib or pressure-variable stroke looks identical before and
 * after `pointerup`. Every binding's Draw overlay maps the result the same
 * way its committed-stroke renderer already maps an `InkStrokeView` (plain
 * path / pressure circles / tilt nib marks).
 *
 * @module render/ink-live-preview
 */
import type { InkPoint } from './ink-drawing';
import { DEFAULT_POINTER_PRESSURE, hasTiltData, pointsToSvgPathD } from './ink-drawing';
import { hasPressureVariation } from './ink-rendering';
import type { InkStrokeView } from './ink-stroke-view';
import { buildInkStrokeView } from './ink-stroke-view';
import { tiltChannelsFromVectors } from './ink-tilt-nib';

/** Options for {@link buildLiveInkStrokeView}. */
export interface LiveInkStrokeViewOpts {
	/**
	 * Accumulated in-progress points, in the overlay's own stage-local
	 * coordinate space. Unlike {@link strokeToInkElement}, these are NOT
	 * translated to a bounding-box origin: a live preview draws directly over
	 * the untranslated stage the same way the plain polyline it replaces
	 * always did.
	 */
	points: InkPoint[];
	color: string;
	width: number;
	tool: 'pen' | 'highlighter' | 'freeform';
}

/**
 * Build the render view for an in-progress stroke, or `null` when there are
 * no points yet (nothing to draw).
 *
 * Mirrors {@link strokeToInkElement}'s pressure/tilt "did it capture real
 * data" decision, but skips the bounding-box translation and the
 * fewer-than-two-points rejection: a live preview must draw starting from the
 * very first point (a single dot is a valid in-progress state, unlike a
 * committed stroke, which requires at least two points to have a path at
 * all).
 */
export function buildLiveInkStrokeView(opts: LiveInkStrokeViewOpts): InkStrokeView | null {
	const { points, color, width, tool } = opts;
	if (points.length === 0) {
		return null;
	}

	const isHighlighter = tool === 'highlighter';
	const path = pointsToSvgPathD(points);

	// Same "did it capture real data" baseline `strokeToInkElement` uses: a
	// uniform pressure/tilt reading (or too few samples) is indistinguishable
	// from "not captured" and must not force a wobbly or leaning preview for a
	// mouse-drawn stroke.
	const pressures = points.map((pt) => pt.pressure ?? DEFAULT_POINTER_PRESSURE);
	const hasPressure = hasPressureVariation(pressures);

	const tiltXs = points.map((pt) => pt.tiltX ?? 0);
	const tiltYs = points.map((pt) => pt.tiltY ?? 0);
	const tilt = hasTiltData(tiltXs, tiltYs) ? tiltChannelsFromVectors(tiltXs, tiltYs) : undefined;

	return buildInkStrokeView({
		path,
		color,
		width,
		opacity: isHighlighter ? 0.4 : 1,
		pressures: hasPressure ? pressures : undefined,
		tiltAngles: tilt?.angles,
		tiltMagnitudes: tilt?.magnitudes,
	});
}
