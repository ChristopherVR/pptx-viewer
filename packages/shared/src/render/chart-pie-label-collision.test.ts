import { describe, expect, it } from 'vitest';

import { LABEL_COLLISION_GAP, nudgeOutsideLabels } from './chart-pie-label-collision';

const box = (id: number, x: number, y: number, w = 40, h = 14) => ({ id, x, y, w, h });

describe('nudgeOutsideLabels', () => {
	it('leaves non-colliding labels alone', () => {
		const nudges = nudgeOutsideLabels([box(0, 200, 50), box(1, 200, 120)], 100, 0, 300);
		expect(nudges.map((n) => n.dy)).toStrictEqual([0, 0]);
	});

	it('pushes the lower of two overlapping labels down by the shortfall plus the gap', () => {
		const nudges = nudgeOutsideLabels([box(0, 200, 50), box(1, 200, 55)], 100, 0, 300);
		expect(nudges[0]!.dy).toBe(0);
		// centres must end (h + gap) apart: 14 + 2 = 16, from 5 apart.
		expect(nudges[1]!.dy).toBeCloseTo(16 - 5);
		expect(LABEL_COLLISION_GAP).toBe(2);
	});

	it('does not mix labels from opposite sides of the pie', () => {
		const nudges = nudgeOutsideLabels([box(0, 200, 50), box(1, 0, 52)], 100, 0, 300);
		expect(nudges.map((n) => n.dy)).toStrictEqual([0, 0]);
	});

	it('shifts a stack back up when it would run past the bottom bound', () => {
		const nudges = nudgeOutsideLabels([box(0, 200, 280), box(1, 200, 282)], 100, 0, 300);
		const y1 = 282 + nudges[1]!.dy;
		expect(y1 + 7).toBeLessThanOrEqual(300);
		const y0 = 280 + nudges[0]!.dy;
		expect(y1 - y0).toBeGreaterThanOrEqual(16 - 1e-9);
	});
});
