/**
 * Framework-neutral view model for `p:contentPart` ink.
 *
 * Every binding paints the same thing from the same data: one SVG per content
 * part, sized to the element box, holding a constant-width `<path>` per
 * stroke, a run of pressure `<circle>`s, or (when the source declared a pen-
 * tilt channel) a run of tilt-driven `<ellipse>` nib marks. This module is
 * the single decision function for that; a binding only maps the returned
 * descriptors onto its own template.
 *
 * It was lifted out of `packages/svelte/src/viewer/render/contentpart-view.ts`
 * when Vue and Angular needed the same logic. Before that, three of the five
 * bindings each had their own copy and Vue and Angular had none at all, so a
 * real inked slide fell through to their "unsupported element" placeholder.
 *
 * @module render/content-part-strokes
 */
import type { ContentPartInkStroke, ContentPartPptxElement } from 'pptx-viewer-core';

import type { PressureCircle } from './ink-rendering';
import {
	extractPathPoints,
	generatePressureCircles,
	hasPressureVariation,
	pressuresToWidths,
} from './ink-rendering';
import type { NibMark } from './ink-tilt-nib';
import { generateNibMarks } from './ink-tilt-nib';

/** One rendered content-part ink stroke: a constant-width path, pressure circles, or tilt nib marks. */
export interface ContentPartStrokeView {
	key: string;
	d: string;
	color: string;
	width: number;
	opacity: number;
	/** Per-point pressure circles; `null` renders the plain `<path>`. Mutually exclusive with `nibMarks`. */
	circles: PressureCircle[] | null;
	/**
	 * Per-point calligraphic nib marks, built from the stroke's tilt channels;
	 * `null` when the source declared no tilt data, in which case `circles`
	 * (or the plain path) renders as before.
	 */
	nibMarks: NibMark[] | null;
}

/** SVG `viewBox` for the content-part element's bounding box (min 1x1). */
export function contentPartViewBox(element: ContentPartPptxElement): string {
	return `0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`;
}

/** Project the element's ink strokes into per-stroke view models. */
export function buildContentPartStrokes(element: ContentPartPptxElement): ContentPartStrokeView[] {
	return (element.inkStrokes ?? []).map((stroke, index) => {
		const nibMarks = nibMarksFor(stroke);
		return {
			key: `stroke${index}`,
			d: stroke.path,
			color: stroke.color,
			width: stroke.width,
			opacity: stroke.opacity,
			// A stroke with tilt data renders as nib marks instead of pressure
			// circles or a plain path; the two are mutually exclusive.
			circles: nibMarks ? null : pressureCirclesFor(stroke),
			nibMarks,
		};
	});
}

/**
 * Build calligraphic nib marks for a stroke that declared tilt data, or
 * `null` when it did not (the caller then falls back to pressure circles or
 * the plain path, exactly as before this feature existed).
 */
function nibMarksFor(stroke: ContentPartInkStroke): NibMark[] | null {
	const angles = stroke.tiltAngles;
	if (!angles || angles.length === 0) {
		return null;
	}
	const magnitudes = stroke.tiltMagnitudes ?? angles.map(() => 0.5);
	const widths =
		stroke.pressures && stroke.pressures.length > 1 && hasPressureVariation(stroke.pressures)
			? pressuresToWidths(stroke.pressures, stroke.width)
			: [stroke.width];
	return generateNibMarks(extractPathPoints(stroke.path), widths, angles, magnitudes, {
		baseWidth: stroke.width,
		minRadius: 0.5,
		maxRadius: stroke.width * 1.5,
	});
}

/**
 * Build the per-point pressure circles for a stroke, or return null when the
 * stroke has no usable (varying) pressure data and should render as a plain
 * constant-width path instead.
 */
function pressureCirclesFor(stroke: ContentPartInkStroke): PressureCircle[] | null {
	const pressures = stroke.pressures;
	if (!pressures || pressures.length <= 1 || !hasPressureVariation(pressures)) {
		return null;
	}
	const pointWidths = pressuresToWidths(pressures, stroke.width);
	return generatePressureCircles(extractPathPoints(stroke.path), pointWidths, {
		baseWidth: stroke.width,
		minRadius: 0.5,
		maxRadius: stroke.width * 1.5,
	});
}
