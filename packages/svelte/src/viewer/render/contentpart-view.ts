import type { ContentPartInkStroke, ContentPartPptxElement } from 'pptx-viewer-core';
import type { PressureCircle } from 'pptx-viewer-shared';
import {
	extractPathPoints,
	generatePressureCircles,
	hasPressureVariation,
	pressuresToWidths,
} from 'pptx-viewer-shared';

/**
 * View-model builder for `contentPart` elements (Svelte port of the vanilla
 * binding's `renderContentPartElement`). Pressure maths (path-point
 * extraction, interpolated widths, circle generation) comes from
 * `pptx-viewer-shared`; this module only resolves per-stroke colour/width/
 * opacity and picks path vs circles, mirroring `ink-view.ts`.
 */

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
	return (element.inkStrokes ?? []).map((stroke, i) => ({
		key: `stroke${i}`,
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
 * constant-width path instead. Mirrors the vanilla `buildStroke` config.
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
