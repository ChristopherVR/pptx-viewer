/**
 * Wall and floor gridlines of the perspective 3D chart box
 * (`chart-3d-persp-layout.ts`), in box space.
 *
 * A column-style box (values up the y axis) draws each value tick on the
 * left wall and the back wall; a horizontal bar box (values along x, as
 * PowerPoint's `c:barDir="bar"` draws them) draws them on the floor and the
 * back wall. Both keep the floor's front and right outer edges.
 *
 * @module chart-3d-persp-gridlines
 */
import type { PerspGridline } from './chart-3d-persp-layout';
import type { PerspBox } from './chart-3d-persp-view';
import { axisTickValues } from './chart-view-model-chrome';

export function buildPerspGridlines(
	box: PerspBox,
	range: { min: number; max: number; majorUnit: number },
	horizontal: boolean,
): PerspGridline[] {
	const { w, h, d } = box;
	const lines: PerspGridline[] = [
		{ from: [0, 0, 0], to: [w, 0, 0] },
		{ from: [w, 0, 0], to: [w, 0, d] },
	];
	const span = range.max - range.min;
	for (const v of axisTickValues({ ...range, span })) {
		const t = (v - range.min) / span;
		if (horizontal) {
			const x = t * w;
			lines.push({ from: [x, 0, 0], to: [x, 0, d] }, { from: [x, 0, d], to: [x, h, d] });
		} else {
			const y = t * h;
			lines.push({ from: [0, y, 0], to: [0, y, d] }, { from: [0, y, d], to: [w, y, d] });
		}
	}
	return lines;
}
