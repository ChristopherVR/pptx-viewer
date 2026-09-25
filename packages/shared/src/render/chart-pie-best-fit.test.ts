import { describe, expect, it } from 'vitest';

import { BEST_FIT_OUTSIDE_GAP, BEST_FIT_RIM_INSET, placeBestFitLabel } from './chart-pie-best-fit';

/** PowerPoint's small test pie (R = 89.625pt) in px, centred on the origin. */
const R = 89.625 * (4 / 3);
/** "25" at 12pt Calibri, boxed: 18.16 x 17.65pt (COM). */
const W = 18.16 * (4 / 3);
const H = 17.65 * (4 / 3);

/** A slice from `from` to `to`, in percent of the pie, starting at 12 o'clock. */
function slice(from: number, to: number) {
	const at = (pct: number) => -Math.PI / 2 + (pct / 100) * 2 * Math.PI;
	return { cx: 0, cy: 0, outerR: R, startAngle: at(from), endAngle: at(to) };
}

function farCorner(x: number, y: number): number {
	return Math.hypot(Math.abs(x) + W / 2, Math.abs(y) + H / 2);
}

describe('placeBestFitLabel', () => {
	it('puts a label that fits inside its slice 4pt inside the rim (COM: 25% slices)', () => {
		const placed = placeBestFitLabel(slice(0, 25), W, H);
		expect(placed.inside).toBeTruthy();
		expect(farCorner(placed.x, placed.y)).toBeCloseTo(R - BEST_FIT_RIM_INSET, 1);
		// On the mid-angle: up and to the right, at 45 degrees.
		expect(placed.x).toBeCloseTo(-placed.y, 5);
		// PowerPoint measured the box centre 73pt out; 0.7R would be 62.7pt.
		expect(Math.hypot(placed.x, placed.y) / (4 / 3)).toBeCloseTo(73, 0);
	});

	it('keeps a label inside a slice of half the pie or more', () => {
		expect(placeBestFitLabel(slice(6, 100), W, H).inside).toBeTruthy();
		expect(placeBestFitLabel(slice(0, 55), W, H).inside).toBeTruthy();
	});

	it('moves a label that does not fit outside, just beyond the rim (COM: 1% and 2% slices)', () => {
		const narrow = 12.08 * (4 / 3);
		for (const [from, to] of [
			[0, 1],
			[1, 3],
		]) {
			const placed = placeBestFitLabel(slice(from, to), narrow, H);
			expect(placed.inside).toBeFalsy();
			// Pointing up: the box's lower edge sits the gap above the rim.
			expect(-placed.y - H / 2).toBeCloseTo(R + BEST_FIT_OUTSIDE_GAP, 0);
		}
	});

	it('keeps a single-digit label inside a 5% slice, as PowerPoint does', () => {
		expect(placeBestFitLabel(slice(0, 5), 12.08 * (4 / 3), H).inside).toBeTruthy();
	});

	it('moves a two-line label out of a 10% slice when it overhangs the edges (COM)', () => {
		const w = 30.86 * (4 / 3);
		const h = 32.3 * (4 / 3);
		// Cat 4 of the 12/11/10/10/... pie: mid-angle 136.8 degrees.
		expect(placeBestFitLabel(slice(33, 43), w, h).inside).toBeFalsy();
		// Cat 1 of the 40/30/20/10 pie keeps its 25% slice.
		expect(placeBestFitLabel(slice(0, 40), w, h).inside).toBeTruthy();
	});
});
