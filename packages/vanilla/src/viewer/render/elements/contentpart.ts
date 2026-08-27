import type { ContentPartInkStroke } from 'pptx-viewer-core';
import {
	extractPathPoints,
	generateNibMarks,
	generatePressureCircles,
	getContentPartReplayStyles,
	getContainerStyle,
	hasPressureVariation,
	INK_REPLAY_KEYFRAMES,
	pressuresToWidths,
} from 'pptx-viewer-shared';
import type { InkStrokeAnimationStyle } from 'pptx-viewer-shared';

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
 * - Tilt-aware calligraphic nib strokes render when a stroke carries
 *   `tiltAngles` (decoded from the source InkML's `OTx`/`OTy` or `AZIMUTH`
 *   channel): each sampled point becomes an `<ellipse>` widened perpendicular
 *   to the pen's lean direction (shared `generateNibMarks` maths), taking
 *   priority over plain pressure circles.
 * - No strokes: a typed fallback box labelled "Content Part", matching the
 *   other bindings' fallback (Vue has no dedicated contentPart renderer and
 *   falls through to its fallback label too).
 * - Presentation mode progressively replays constant-width paths using the
 *   shared dash-offset timing model.
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
	const replayStyles = context.presenting ? getContentPartReplayStyles(strokes) : [];
	if (context.presenting) {
		const keyframes = createSvgEl(doc, 'style');
		keyframes.textContent = INK_REPLAY_KEYFRAMES;
		svg.appendChild(keyframes);
	}

	for (const [index, stroke] of strokes.entries()) {
		svg.appendChild(buildStroke(doc, stroke, replayStyles[index]));
	}

	el.appendChild(svg);
	return el;
};

/**
 * Build one stroke: pressure circles when the stroke has usable (varying)
 * per-point pressure data, a plain constant-width path otherwise. Mirrors
 * React's `renderPressureStroke` config exactly.
 */
function buildStroke(
	doc: Document,
	stroke: ContentPartInkStroke,
	replay: InkStrokeAnimationStyle | undefined,
): SVGElement {
	if (stroke.tiltAngles && stroke.tiltAngles.length > 0) {
		const magnitudes = stroke.tiltMagnitudes ?? stroke.tiltAngles.map(() => 0.5);
		const widths =
			stroke.pressures && stroke.pressures.length > 1 && hasPressureVariation(stroke.pressures)
				? pressuresToWidths(stroke.pressures, stroke.width)
				: [stroke.width];
		const marks = generateNibMarks(
			extractPathPoints(stroke.path),
			widths,
			stroke.tiltAngles,
			magnitudes,
			{
				baseWidth: stroke.width,
				minRadius: 0.5,
				maxRadius: stroke.width * 1.5,
			},
		);
		const g = createSvgEl(doc, 'g', { opacity: stroke.opacity });
		for (const m of marks) {
			g.appendChild(
				createSvgEl(doc, 'ellipse', {
					cx: m.cx,
					cy: m.cy,
					rx: m.rPerp,
					ry: m.rTilt,
					transform: `rotate(${m.rotationDeg} ${m.cx} ${m.cy})`,
					fill: stroke.color,
				}),
			);
		}
		return g;
	}

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

	const path = createSvgEl(doc, 'path', {
		d: stroke.path,
		fill: 'none',
		stroke: stroke.color,
		'stroke-width': stroke.width,
		'stroke-opacity': stroke.opacity,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
		'vector-effect': 'non-scaling-stroke',
		'stroke-dasharray': replay?.strokeDasharray,
		'stroke-dashoffset': replay?.strokeDashoffset,
	});
	if (replay) {
		path.style.animation = replay.animation;
		path.style.setProperty('--ink-path-length', String(replay.pathLength));
	}
	return path;
}
