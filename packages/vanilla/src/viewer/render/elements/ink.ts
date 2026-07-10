import type { InkPptxElement } from 'pptx-viewer-core';
import type { PressureCircle } from 'pptx-viewer-shared';
import {
	DEFAULT_STROKE_COLOR,
	extractPathPoints,
	generatePressureCircles,
	getContainerStyle,
	hasPressureVariation,
	pressuresToWidths,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import type { ElementRenderer } from '../types';

/**
 * Renderer for `ink` elements, vanilla port of Vue's `InkRenderer.vue`
 * (viewer subset):
 *
 * Freehand ink strokes (`inkPaths`) render as inline SVG `<path>`s inside the
 * element's bounding box, with per-stroke colour / width / opacity resolved
 * from the parallel `inkColors` / `inkWidths` / `inkOpacities` arrays.
 *
 * Pressure-sensitive variable-width strokes render when the element carries
 * per-point pressure data (`inkPointPressures`), or a legacy per-point
 * `inkWidths` array with variation: each sampled point becomes a `<circle>`
 * whose radius follows the interpolated width (shared
 * `generatePressureCircles` maths). Strokes without pressure data degrade to
 * plain constant-width paths.
 *
 * Not ported (same gaps as Vue): ink replay animation and the
 * highlighter / eraser tool blend modes.
 */
export const renderInkElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'ink') {
		return null;
	}
	const doc = context.document;
	const wrapper = createEl(
		doc,
		'div',
		'pptxv-element pptxv-ink',
		getContainerStyle(element, zIndex),
	);
	wrapper.dataset.elementId = element.id;

	const paths = element.inkPaths;
	if (paths.length === 0) {
		return wrapper;
	}

	const w = Math.max(element.width, 1);
	const h = Math.max(element.height, 1);
	const svg = createSvgEl(doc, 'svg', {
		viewBox: `0 0 ${w} ${h}`,
		preserveAspectRatio: 'none',
	});
	svg.setAttribute('class', 'pptxv-ink-svg');
	svg.setAttribute('style', 'width:100%;height:100%;pointer-events:none;display:block');

	paths.forEach((d, i) => {
		const color = element.inkColors?.[i] ?? DEFAULT_STROKE_COLOR;
		const width = element.inkWidths?.[i] ?? 1;
		const opacity = element.inkOpacities?.[i] ?? 1;

		const circles = pressureCirclesFor(element, d, i, width);
		if (circles) {
			const g = createSvgEl(doc, 'g', { opacity });
			for (const c of circles) {
				g.appendChild(createSvgEl(doc, 'circle', { cx: c.cx, cy: c.cy, r: c.r, fill: color }));
			}
			svg.appendChild(g);
			return;
		}

		svg.appendChild(
			createSvgEl(doc, 'path', {
				d,
				fill: 'none',
				stroke: color,
				'stroke-width': width,
				'stroke-opacity': opacity,
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
				'vector-effect': 'non-scaling-stroke',
			}),
		);
	});

	wrapper.appendChild(svg);
	return wrapper;
};

/**
 * Build the per-point pressure circles for a stroke, or return null when the
 * stroke has no usable (varying) pressure data and should render as a plain
 * constant-width path instead. Mirrors Vue's `pressureCirclesFor` exactly.
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
