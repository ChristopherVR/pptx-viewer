/**
 * Framework-neutral view model for `p:contentPart` ink.
 *
 * Every binding paints the same thing from the same data: one SVG per content
 * part, sized to the element box, holding either a constant-width `<path>` per
 * stroke or a run of pressure `<circle>`s. This module is the single decision
 * function for that; a binding only maps the returned descriptors onto its own
 * template.
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

/** One rendered content-part ink stroke: a constant-width path, or pressure circles. */
export interface ContentPartStrokeView {
	key: string;
	d: string;
	color: string;
	width: number;
	opacity: number;
	/** Per-point pressure circles; `null` renders the plain `<path>`. */
	circles: PressureCircle[] | null;
}

/** SVG `viewBox` for the content-part element's bounding box (min 1x1). */
export function contentPartViewBox(element: ContentPartPptxElement): string {
	return `0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`;
}

/** Project the element's ink strokes into per-stroke view models. */
export function buildContentPartStrokes(element: ContentPartPptxElement): ContentPartStrokeView[] {
	return (element.inkStrokes ?? []).map((stroke, index) => ({
		key: `stroke${index}`,
		d: stroke.path,
		color: stroke.color,
		width: stroke.width,
		opacity: stroke.opacity,
		circles: pressureCirclesFor(stroke),
	}));
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
