import type { ContentPartInkStroke } from 'pptx-viewer-core';
import {
	extractPathPoints,
	generatePressureCircles,
	getContainerStyle,
	hasPressureVariation,
	pressuresToWidths,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import type { ElementRenderer } from '../types';

/**
 * Renderer for `contentPart` elements (embedded XML drawing parts wrapped in
 * `mc:AlternateContent`), vanilla port of React's `renderContentPart` in
 * `InkGroupRenderers.tsx` (viewer subset):
 *
 * - Ink strokes (`inkStrokes`) render as inline SVG `<path>`s inside the
 *   element's bounding box, with per-stroke colour / width / opacity.
 * - Pressure-sensitive variable-width strokes render when a stroke carries
 *   varying per-point `pressures`: each sampled point becomes a `<circle>`
 *   whose radius follows the interpolated width (shared
 *   `generatePressureCircles` maths, same config as React).
 * - No strokes: a typed fallback box labelled "Content Part", matching the
 *   other bindings' fallback (Vue has no dedicated contentPart renderer and
 *   falls through to its fallback label too).
 *
 * Not ported (same gap as the `ink` renderer): the ink replay animation,
 * which only runs in presentation mode.
 */
export const renderContentPartElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'contentPart') {
		return null;
	}
	const doc = context.document;
	const el = createEl(
		doc,
		'div',
		'pptxv-element pptxv-contentpart',
		getContainerStyle(element, zIndex),
	);
	el.dataset.elementId = element.id;

	const strokes = element.inkStrokes;
	if (!strokes || strokes.length === 0) {
		// Reuse the placeholder look for a graceful typed fallback box.
		el.classList.add('pptxv-placeholder');
		const label = createEl(doc, 'div', 'pptxv-placeholder-label');
		label.textContent = context.t('pptx.ink.contentPartFallback');
		el.appendChild(label);
		return el;
	}

	const w = Math.max(element.width, 1);
	const h = Math.max(element.height, 1);
	const svg = createSvgEl(doc, 'svg', {
		viewBox: `0 0 ${w} ${h}`,
		preserveAspectRatio: 'none',
	});
	svg.setAttribute('class', 'pptxv-contentpart-svg');
	svg.setAttribute('style', 'width:100%;height:100%;pointer-events:none;display:block');

	for (const stroke of strokes) {
		svg.appendChild(buildStroke(doc, stroke));
	}

	el.appendChild(svg);
	return el;
};

/**
 * Build one stroke: pressure circles when the stroke has usable (varying)
 * per-point pressure data, a plain constant-width path otherwise. Mirrors
 * React's `renderPressureStroke` config exactly.
 */
function buildStroke(doc: Document, stroke: ContentPartInkStroke): SVGElement {
	const pressures = stroke.pressures;
	if (pressures && pressures.length > 1 && hasPressureVariation(pressures)) {
		const pointWidths = pressuresToWidths(pressures, stroke.width);
		const circles = generatePressureCircles(extractPathPoints(stroke.path), pointWidths, {
			baseWidth: stroke.width,
			minRadius: 0.5,
			maxRadius: stroke.width * 1.5,
		});
		const g = createSvgEl(doc, 'g', { opacity: stroke.opacity });
		for (const c of circles) {
			g.appendChild(createSvgEl(doc, 'circle', { cx: c.cx, cy: c.cy, r: c.r, fill: stroke.color }));
		}
		return g;
	}

	return createSvgEl(doc, 'path', {
		d: stroke.path,
		fill: 'none',
		stroke: stroke.color,
		'stroke-width': stroke.width,
		'stroke-opacity': stroke.opacity,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
		'vector-effect': 'non-scaling-stroke',
	});
}
