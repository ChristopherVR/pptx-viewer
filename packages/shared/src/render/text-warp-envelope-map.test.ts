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

	it('places horizontal position by arc length along the can half-ellipse', () => {
		// `textCanUp` adj 66667 in a 600x200 box: the top path is a half
		// ellipse, rx = 300, ry = h - adj * h = 66.67. Independently measure the
		// point at arc-length fraction s on a fine parametric polyline.
		const rx = 300;
		const ry = 200 * (1 - 0.66667);
		const n = 20000;
		const pts: { x: number; len: number }[] = [];
		let len = 0;
		let prev = { x: 0, y: 0 };
		for (let i = 0; i <= n; i++) {
			const t = Math.PI - (Math.PI * i) / n;
			const p = { x: rx + rx * Math.cos(t), y: -ry * Math.sin(t) };
			if (i > 0) {
				len += Math.hypot(p.x - prev.x, p.y - prev.y);
			}
			pts.push({ x: p.x, len });
			prev = p;
		}
		const xAtFraction = (f: number) => pts.find((p) => p.len >= f * len)!.x;
		const warp = createEnvelopeWarp('textCanUp', 600, 200, 66667, undefined, BLOCK)!;
		for (const s of [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98]) {
			expect(Math.abs(warp.map(s, 0.5).x - xAtFraction(s))).toBeLessThan(0.6);
		}
		// Steep cylinder ends compress: near an end, arc length covers less x.
		expect(warp.map(0.05, 0.5).x).toBeLessThan(0.05 * 600 - 5);
		expect(warp.map(0.95, 0.5).x).toBeGreaterThan(0.95 * 600 + 5);
	});

	it('moves glyphs with curve depth, as PowerPoint does (COM 2026-09-25)', () => {
		// PowerPoint COM, 8-stem Arial "IIIIIIII" in a 600x285pt `textCanUp` box,
		// exported at 1920px: the second stem's left ink edge sits at 327px at
		// adj 66667 (deep) but 373px at adj 96667 (shallow). A placement law
		// independent of curve shape (linear x) cannot move it at all.
		const deep = createEnvelopeWarp('textCanUp', 600, 285, 66667, undefined, BLOCK)!;
		const shallow = createEnvelopeWarp('textCanUp', 600, 285, 96667, undefined, BLOCK)!;
		for (const s of [0.1, 0.2, 0.35]) {
			expect(shallow.map(s, 0.5).x - deep.map(s, 0.5).x).toBeGreaterThan(5);
		}
	});

	it('clamps adj to the preset pin range, so out-of-range values draw the pinned shape', () => {
		// `textCanUp` pins adj to [66667, 100000]: 15000 and 50000 both draw the
		// 66667 cylinder (why an earlier "adj-independent" reading was void).
		const pinned = createEnvelopeWarp('textCanUp', 600, 200, 66667, undefined, BLOCK)!;
		for (const adj of [15000, 50000]) {
			const warp = createEnvelopeWarp('textCanUp', 600, 200, adj, undefined, BLOCK)!;
			for (const s of [0.1, 0.35, 0.8]) {
				expect(warp.map(s, 0.5).x).toBeCloseTo(pinned.map(s, 0.5).x, 6);
				expect(warp.map(s, 0.5).y).toBeCloseTo(pinned.map(s, 0.5).y, 6);
			}
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
