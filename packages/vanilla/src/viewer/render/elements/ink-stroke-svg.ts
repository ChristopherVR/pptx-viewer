import type { InkStrokeAnimationStyle, InkStrokeView } from 'pptx-viewer-shared';

import { createSvgEl } from '../dom';

/**
 * Build one already-decided stroke's SVG node: tilt-driven nib ellipses, then
 * pressure circles, then a plain constant-width path (the same priority order
 * `InkStrokeView` documents). Shared by `ink.ts` (Draw-tab `InkPptxElement`)
 * and `contentpart.ts` (loaded `p:contentPart`), which used to each hand-roll
 * this exact branch.
 */
export function buildStrokeSvg(
	doc: Document,
	view: InkStrokeView,
	replay: InkStrokeAnimationStyle | undefined,
): SVGElement {
	if (view.nibMarks) {
		const g = createSvgEl(doc, 'g', { opacity: view.opacity });
		for (const m of view.nibMarks) {
			g.appendChild(
				createSvgEl(doc, 'ellipse', {
					cx: m.cx,
					cy: m.cy,
					rx: m.rPerp,
					ry: m.rTilt,
					transform: `rotate(${m.rotationDeg} ${m.cx} ${m.cy})`,
					fill: view.color,
				}),
			);
		}
		return g;
	}

	if (view.circles) {
		const g = createSvgEl(doc, 'g', { opacity: view.opacity });
		for (const c of view.circles) {
			g.appendChild(createSvgEl(doc, 'circle', { cx: c.cx, cy: c.cy, r: c.r, fill: view.color }));
		}
		return g;
	}

	const path = createSvgEl(doc, 'path', {
		d: view.d,
		fill: 'none',
		stroke: view.color,
		'stroke-width': view.width,
		'stroke-opacity': view.opacity,
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
