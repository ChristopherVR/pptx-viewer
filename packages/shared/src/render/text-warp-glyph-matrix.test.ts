import { describe, expect, it } from 'vitest';

import { edgeBandAt, sliceBand } from './text-warp-glyph-matrix';

describe('sliceBand', () => {
	it('returns the whole band unchanged for a single slice', () => {
		expect(sliceBand(10, 90, 0, 1)).toStrictEqual({ top: 10, bottom: 90 });
	});

	it('splits a band into equal fractional pieces', () => {
		expect(sliceBand(0, 100, 0, 4)).toStrictEqual({ top: 0, bottom: 25 });
		expect(sliceBand(0, 100, 1, 4)).toStrictEqual({ top: 25, bottom: 50 });
		expect(sliceBand(0, 100, 3, 4)).toStrictEqual({ top: 75, bottom: 100 });
	});
});

describe('edgeBandAt', () => {
	const HEIGHT = 200;

	it('is unchanged for a single-line element (lineCount <= 1), matching the deformed band directly', () => {
		for (const u of [0, 0.25, 0.5, 0.75, 1]) {
			const edge = edgeBandAt('textInflate', u, undefined, undefined, HEIGHT, 0, 1);
			// A single line never gets the multi-row shared-boundary treatment:
			// both edges bend with the curve at this exact u.
			expect(edge.top).toBeLessThan(edge.bottom);
		}
	});

	describe('multi-paragraph shared boundary (COM review 2026-09-11)', () => {
		// Two rows sharing a boundary must always report the IDENTICAL value
		// for that boundary, regardless of `u` - the fix this module makes:
		// a naive per-u slice of the deformed band let two rows sampling
		// different `u` (as independently laid-out paragraphs do) compute a
		// crossing pair of edges (row 0's bottom below row 1's top).
		it("row 0's bottom always equals row 1's top, for ANY pair of u values", () => {
			const preset = 'textInflate';
			const lineCount = 2;
			for (const uRow0 of [0, 0.2, 0.45, 0.7, 1]) {
				for (const uRow1 of [0, 0.3, 0.6, 0.9, 1]) {
					const row0 = edgeBandAt(preset, uRow0, undefined, undefined, HEIGHT, 0, lineCount);
					const row1 = edgeBandAt(preset, uRow1, undefined, undefined, HEIGHT, 1, lineCount);
					expect(row0.bottom).toBeCloseTo(row1.top, 10);
				}
			}
		});

		it('the shared boundary is constant across every u for a given row (the inner edge never bends)', () => {
			const preset = 'textInflate';
			const bottoms = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1].map(
				(u) => edgeBandAt(preset, u, undefined, undefined, HEIGHT, 0, 2).bottom,
			);
			const first = bottoms[0];
			for (const b of bottoms) {
				expect(b).toBeCloseTo(first, 10);
			}
		});

		it("row 0's own OUTER (top) edge still bends across u (genuine per-glyph height variation survives)", () => {
			const preset = 'textInflate';
			const tops = [0, 0.25, 0.5, 0.75, 1].map(
				(u) => edgeBandAt(preset, u, undefined, undefined, HEIGHT, 0, 2).top,
			);
			expect(new Set(tops.map((t) => t.toFixed(4))).size).toBeGreaterThan(1);
		});

		it('a 3-row split keeps every adjacent pair of boundaries consistent (interior row: both edges shared)', () => {
			const preset = 'textInflate';
			const lineCount = 3;
			for (const u of [0, 0.3, 0.6, 1]) {
				const row0 = edgeBandAt(preset, u, undefined, undefined, HEIGHT, 0, lineCount);
				const row1Top = edgeBandAt(preset, 0.5, undefined, undefined, HEIGHT, 1, lineCount).top;
				const row1Bottom = edgeBandAt(
					preset,
					0.5,
					undefined,
					undefined,
					HEIGHT,
					1,
					lineCount,
				).bottom;
				const row2 = edgeBandAt(preset, u, undefined, undefined, HEIGHT, 2, lineCount);
				expect(row0.bottom).toBeCloseTo(row1Top, 10);
				expect(row1Bottom).toBeCloseTo(row2.top, 10);
			}
		});

		it('never reports an inverted band (top < bottom) for any row/u combination tested', () => {
			const preset = 'textInflate';
			for (const lineCount of [2, 3]) {
				for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
					for (const u of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
						const edge = edgeBandAt(preset, u, undefined, undefined, HEIGHT, lineIndex, lineCount);
						expect(edge.top).toBeLessThan(edge.bottom);
					}
				}
			}
		});
	});
});
