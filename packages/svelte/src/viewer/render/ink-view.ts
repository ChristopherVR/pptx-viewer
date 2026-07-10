import type { InkPptxElement } from 'pptx-viewer-core';
import type { PressureCircle } from 'pptx-viewer-shared';
import {
	DEFAULT_STROKE_COLOR,
	extractPathPoints,
	generatePressureCircles,
	hasPressureVariation,
	pressuresToWidths,
} from 'pptx-viewer-shared';

/**
 * View-model builder for `ink` elements (port of the vanilla binding's
 * `renderInkElement`). Pressure maths (path-point extraction, interpolated
 * widths, circle generation) come from `pptx-viewer-shared`; this module only
 * resolves per-stroke colour/width/opacity and picks path vs circles.
 */

/** One rendered ink stroke: a constant-width path, or pressure circles. */
export interface InkStrokeView {
	key: string;
	d: string;
	color: string;
	width: number;
	opacity: number;
	/** Per-point pressure circles; `null` renders the plain `<path>`. */
	circles: PressureCircle[] | null;
}

/** SVG `viewBox` for the ink element's bounding box (min 1x1). */
export function inkViewBox(element: InkPptxElement): string {
	return `0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`;
}

/** Project the element's parallel ink arrays into per-stroke view models. */
export function buildInkStrokes(element: InkPptxElement): InkStrokeView[] {
	return element.inkPaths.map((d, i) => {
		const width = element.inkWidths?.[i] ?? 1;
		return {
			key: `stroke${i}`,
			d,
			color: element.inkColors?.[i] ?? DEFAULT_STROKE_COLOR,
			width,
			opacity: element.inkOpacities?.[i] ?? 1,
			circles: pressureCirclesFor(element, d, i, width),
		};
	});
}

/**
 * Build the per-point pressure circles for a stroke, or return null when the
 * stroke has no usable (varying) pressure data and should render as a plain
 * constant-width path instead. Mirrors Vue's / vanilla's `pressureCirclesFor`.
 */
function pressureCirclesFor(
	el: InkPptxElement,
	pathD: string,
	index: number,
	width: number,
): PressureCircle[] | null {
	const config = { baseWidth: width, minRadius: 0.5, maxRadius: width * 1.5 };

	// Prefer per-point pressure from the stylus (inkPointPressures[index]).
	const pointPressures = el.inkPointPressures?.[index];
	if (pointPressures && pointPressures.length > 1 && hasPressureVariation(pointPressures)) {
		const pointWidths = pressuresToWidths(pointPressures, width);
		return generatePressureCircles(extractPathPoints(pathD), pointWidths, config);
	}

	// Legacy fallback: treat the inkWidths array as per-point widths only when it
	// carries more entries than there are paths (so a normal per-path widths array
	// is never mistaken for pressure data) and shows variation.
	if (
		el.inkWidths &&
		el.inkWidths.length > el.inkPaths.length &&
		hasPressureVariation(el.inkWidths)
	) {
		return generatePressureCircles(extractPathPoints(pathD), el.inkWidths, config);
	}

	return null;
}
