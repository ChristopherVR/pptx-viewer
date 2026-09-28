import { describe, expect, it } from 'vitest';

import { LABEL_COLLISION_GAP, nudgeOutsideLabels } from './chart-pie-label-collision';

const DISC = { cx: 100, cy: 150, r: 20 };
const box = (id: number, x: number, y: number, w = 40, h = 14) => ({ id, x, y, w, h });

describe('nudgeOutsideLabels', () => {
	it('leaves non-colliding labels alone', () => {
		const nudges = nudgeOutsideLabels([box(0, 200, 50), box(1, 200, 120)], DISC, 0, 300);
		expect(nudges.map((n) => n.dy)).toStrictEqual([0, 0]);
	});

	it('pushes the lower of two overlapping labels down by the shortfall plus the gap', () => {
		const nudges = nudgeOutsideLabels([box(0, 200, 50), box(1, 200, 55)], DISC, 0, 300);
		expect(nudges[0]!.dy).toBe(0);
		// centres must end (h + gap) apart: 14 + 2 = 16, from 5 apart.
		expect(nudges[1]!.dy).toBeCloseTo(16 - 5);
		expect(LABEL_COLLISION_GAP).toBe(2);
	});

	it('does not mix labels from opposite sides of the pie', () => {
		const nudges = nudgeOutsideLabels([box(0, 200, 50), box(1, 0, 52)], DISC, 0, 300);
		expect(nudges.map((n) => n.dy)).toStrictEqual([0, 0]);
	});

	it('shifts a stack back up when it would run past the bottom bound', () => {
		const nudges = nudgeOutsideLabels([box(0, 200, 280), box(1, 200, 282)], DISC, 0, 300);
		const y1 = 282 + nudges[1]!.dy;
		expect(y1 + 7).toBeLessThanOrEqual(300);
		const y0 = 280 + nudges[0]!.dy;
		expect(y1 - y0).toBeGreaterThanOrEqual(16 - 1e-9);
	});
});

describe('nudgeOutsideLabels near the pie', () => {
	it('never pushes a label into the pie disc', () => {
		const disc = { cx: 100, cy: 100, r: 60 };
		// Two labels just below the pie (6 o'clock), overlapping; the upper one
		// would be shifted up into the disc by the bottom bound.
		const boxes = [box(0, 95, 168), box(1, 105, 172)];
		const nudges = nudgeOutsideLabels(boxes, disc, 0, 180);
		for (const [i, b] of boxes.entries()) {
			const x = b.x + nudges[i]!.dx;
			const y = b.y + nudges[i]!.dy;
			const nearestX = Math.max(x - b.w / 2, Math.min(disc.cx, x + b.w / 2));
			const nearestY = Math.max(y - b.h / 2, Math.min(disc.cy, y + b.h / 2));
			expect(Math.hypot(nearestX - disc.cx, nearestY - disc.cy)).toBeGreaterThanOrEqual(disc.r);
		}
	});
});
