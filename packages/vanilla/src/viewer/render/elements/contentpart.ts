import {
	buildContentPartStrokes,
	getContentPartReplayStyles,
	getContainerStyle,
	INK_REPLAY_KEYFRAMES,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import type { ElementRenderer } from '../types';
import { buildStrokeSvg } from './ink-stroke-svg';

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

	const views = buildContentPartStrokes(element);
	for (const [index, view] of views.entries()) {
		svg.appendChild(buildStrokeSvg(doc, view, replayStyles[index]));
	}

	el.appendChild(svg);
	return el;
};
