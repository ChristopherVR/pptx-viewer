import { describe, expect, it } from 'vitest';

import { envelopeCurveAt } from './text-warp-envelope-curves';
import { createEnvelopeWarp } from './text-warp-envelope-map';

const BLOCK = { left: 0, top: 0, right: 1, bottom: 1 };

describe('createEnvelopeWarp', () => {
	it('is undefined for a non-envelope preset or a degenerate box/block', () => {
		expect(createEnvelopeWarp('textArchUp', 600, 200, undefined, undefined, BLOCK)).toBeUndefined();
		expect(createEnvelopeWarp('textInflate', 0, 200, undefined, undefined, BLOCK)).toBeUndefined();
		expect(
			createEnvelopeWarp('textInflate', 600, 200, undefined, undefined, { ...BLOCK, right: 0 }),
		).toBeUndefined();
	});

	it('maps a flat envelope (adj 0) as a plain box-to-box stretch', () => {
		const warp = createEnvelopeWarp('textInflate', 600, 200, 0, undefined, {
			left: 10,
			top: -30,
			right: 110,
			bottom: 10,
		})!;
		expect(warp.map(10, -30).x).toBeCloseTo(0, 6);
		expect(warp.map(10, -30).y).toBeCloseTo(0, 6);
		expect(warp.map(110, 10).x).toBeCloseTo(600, 6);
		expect(warp.map(110, 10).y).toBeCloseTo(200, 6);
		expect(warp.map(60, -10).x).toBeCloseTo(300, 4);
		expect(warp.map(60, -10).y).toBeCloseTo(100, 4);
	});

	it('puts the block top on the top curve and its bottom on the bottom curve', () => {
		const warp = createEnvelopeWarp('textCanDown', 600, 200, 33333, undefined, BLOCK)!;
		for (const s of [0.1, 0.35, 0.5, 0.8]) {
			const top = warp.map(s, 0);
			const bottom = warp.map(s, 1);
			const curveTop = envelopeCurveAt('textCanDown', top.x / 600, 33333)!;
			const curveBottom = envelopeCurveAt('textCanDown', bottom.x / 600, 33333)!;
			expect(top.y / 200).toBeCloseTo(curveTop.top, 3);
			expect(bottom.y / 200).toBeCloseTo(curveBottom.bottom, 3);
		}
	});

	it('places horizontal position by arc length along the cylinder (COM-pinned)', () => {
		// PowerPoint COM, 2026-09-24: 12 Arial `I` stems in a 600x200pt
		// `textCanUp` box at adj 66667. Left edge of each stem in the flat
		// (unwarped) block vs. where PowerPoint drew it, both as box fractions.
		const warp = createEnvelopeWarp('textCanUp', 600, 200, 66667, undefined, BLOCK)!;
		const pinned: [number, number][] = [
			[0.0892, 0.0717],
			[0.1762, 0.1608],
			[0.2654, 0.2537],
			[0.3525, 0.3454],
			[0.4412, 0.4396],
			[0.7046, 0.7171],
			[0.8808, 0.9004],
		];
		for (const [flat, measured] of pinned) {
			expect(Math.abs(warp.map(flat, 0.5).x / 600 - measured)).toBeLessThan(0.003);
		}
	});

	it('keeps a can glyph height constant along the line (parallel curves)', () => {
		const warp = createEnvelopeWarp('textCanUp', 600, 200, 85714, undefined, BLOCK)!;
		const heights = [0.05, 0.3, 0.5, 0.9].map((s) => warp.map(s, 1).y - warp.map(s, 0).y);
		for (const h of heights) {
			expect(h).toBeCloseTo(heights[0], 3);
		}
	});

	it('mirrors textCanUp and textCanDown horizontally for the same cylinder depth', () => {
		const up = createEnvelopeWarp('textCanUp', 600, 200, 80000, undefined, BLOCK)!;
		const down = createEnvelopeWarp('textCanDown', 600, 200, 20000, undefined, BLOCK)!;
		for (const s of [0.1, 0.25, 0.6]) {
			expect(up.map(s, 0.5).x).toBeCloseTo(down.map(s, 0.5).x, 6);
		}
	});
});
