import {
	buildInkGroupStrokes,
	DEFAULT_STROKE_COLOR,
	getContainerStyle,
	getInkReplayStyles,
	INK_REPLAY_KEYFRAMES,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import type { ElementRenderer } from '../types';
import { buildStrokeSvg } from './ink-stroke-svg';

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
 * `generatePressureCircles` maths). Tilt-aware calligraphic nib strokes render
 * when a path carries genuine `inkPointTiltX`/`inkPointTiltY` lean, taking
 * priority over pressure circles (shared `buildInkGroupStrokes` decision
 * function, the same one `contentpart.ts` uses for a loaded `p:contentPart`).
 * Strokes without either degrade to plain constant-width paths.
 *
 * Presentation mode progressively replays constant-width paths using the
 * shared dash-offset timing model. Highlighter strokes use multiply blending.
 * Pressure circles and nib marks remain static because SVG dash replay only
 * applies to paths.
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
	if (element.inkTool === 'highlighter') {
		svg.style.mixBlendMode = 'multiply';
	}
	const replayStyles = context.presenting ? getInkReplayStyles(element) : [];
	if (context.presenting) {
		const keyframes = createSvgEl(doc, 'style');
		keyframes.textContent = INK_REPLAY_KEYFRAMES;
		svg.appendChild(keyframes);
	}

	const views = buildInkGroupStrokes(element, { color: DEFAULT_STROKE_COLOR, width: 1 });
	for (const [i, view] of views.entries()) {
		svg.appendChild(buildStrokeSvg(doc, view, replayStyles[i]));
	}

	wrapper.appendChild(svg);
	return wrapper;
};
