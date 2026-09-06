import { describe, expect, it } from 'vitest';

import { NOMINAL_ENVELOPE_BAND } from './text-warp-envelope-curves';
import {
	buildGlyphSlices,
	chooseGlyphSliceCount,
	MAX_ENVELOPE_GLYPH_SLICES,
} from './text-warp-glyph-slicing';

const { top: nomTop, bottom: nomBottom } = NOMINAL_ENVELOPE_BAND;
const HEIGHT = 200;

/** Parse a glyph's `matrix(1 b 0 d 0 f)` transform into its `{ b, d, f }` terms. */
function parseMatrix(transform: string): { b: number; d: number; f: number } {
	const match =
		/matrix\(\s*1\s+(-?[\d.eE+-]+)\s+0\s+(-?[\d.eE+-]+)\s+0\s+(-?[\d.eE+-]+)\s*\)/u.exec(
			transform,
		)!;
	return { b: Number(match[1]), d: Number(match[2]), f: Number(match[3]) };
}

/** Evaluate `matrix(1 b 0 d 0 f)` at a point: `y' = b*x + d*y + f`. */
function evalMatrix(transform: string, x: number, y: number): number {
	const { b, d, f } = parseMatrix(transform);
	return b * x + d * y + f;
}

describe('chooseGlyphSliceCount', () => {
	it('returns 1 for a non-envelope-curving span (degenerate/zero height)', () => {
		expect(chooseGlyphSliceCount('textInflate', 0.2, 0.3, undefined, undefined, 0, 0, 1)).toBe(1);
		expect(chooseGlyphSliceCount('textInflate', 0.3, 0.3, undefined, undefined, HEIGHT, 0, 1)).toBe(
			1,
		);
	});

	it('returns 1 when maxSlices is capped to 1', () => {
		// A glyph spanning almost the whole line of a `can` preset at extreme adj
		// would otherwise need many slices; a caller capping maxSlices=1 must
		// still get the pre-slicing behaviour back.
		const n = chooseGlyphSliceCount('textCanUp', 0, 1, 66667, undefined, HEIGHT, 0, 1, 1);
		expect(n).toBe(1);
	});

	it('returns 1 for a narrow glyph span (little curvature within it)', () => {
		const n = chooseGlyphSliceCount('textInflate', 0.49, 0.51, undefined, undefined, HEIGHT, 0, 1);
		expect(n).toBe(1);
	});

	it('returns more than 1 for a very wide glyph spanning strong curvature', () => {
		// A single glyph spanning almost the whole line of `textCanUp` at an
		// extreme adjust value is exactly the "6-8 very wide glyphs filling the
		// box" scenario the limitations doc calls out.
		const n = chooseGlyphSliceCount('textCanUp', 0.05, 0.55, 66667, undefined, HEIGHT, 0, 1);
		expect(n).toBeGreaterThan(1);
	});

	it('never exceeds maxSlices, even for an extreme span', () => {
		const n = chooseGlyphSliceCount('textCanUp', 0, 1, 66667, undefined, HEIGHT, 0, 1);
		expect(n).toBeLessThanOrEqual(MAX_ENVELOPE_GLYPH_SLICES);
	});

	it('is monotonic-ish: a wider span of the same curvy region needs at least as many slices', () => {
		const narrow = chooseGlyphSliceCount('textCanUp', 0.2, 0.3, 66667, undefined, HEIGHT, 0, 1);
		const wide = chooseGlyphSliceCount('textCanUp', 0.1, 0.5, 66667, undefined, HEIGHT, 0, 1);
		expect(wide).toBeGreaterThanOrEqual(narrow);
	});
});

describe('buildGlyphSlices', () => {
	it('returns exactly sliceCount entries tiling [x0, x1] left-to-right', () => {
		const slices = buildGlyphSlices(
			'textCanUp',
			100,
			160,
			0.1,
			0.4,
			66667,
			undefined,
			HEIGHT,
			0,
			1,
			nomTop * HEIGHT,
			nomBottom * HEIGHT,
			4,
		);
		expect(slices).toHaveLength(4);
		// First slice starts at the glyph's own left edge (no overlap padding there).
		expect(slices[0].clipX0).toBe(100);
		// Last slice ends at the glyph's own right edge (no overlap padding there).
		expect(slices[slices.length - 1].clipX1).toBe(160);
		for (let i = 1; i < slices.length; i++) {
			expect(slices[i].clipX0).toBeLessThan(slices[i - 1].clipX1);
		}
	});

	it('pads only INTERIOR boundaries, not the glyph outer edges', () => {
		const slices = buildGlyphSlices(
			'textInflate',
			0,
			90,
			0,
			0.3,
			undefined,
			undefined,
			HEIGHT,
			0,
			1,
			nomTop * HEIGHT,
			nomBottom * HEIGHT,
			3,
		);
		expect(slices[0].clipX0).toBe(0);
		expect(slices[2].clipX1).toBe(90);
		// Interior seams: slice 0's right edge and slice 1's left edge overlap.
		expect(slices[0].clipX1).toBeGreaterThan(slices[1].clipX0);
	});

	it('degrades to a single slice identical in shape to the unsliced fit request', () => {
		const slices = buildGlyphSlices(
			'textDeflate',
			10,
			30,
			0.4,
			0.5,
			undefined,
			undefined,
			HEIGHT,
			0,
			1,
			nomTop * HEIGHT,
			nomBottom * HEIGHT,
			1,
		);
		expect(slices).toHaveLength(1);
		expect(slices[0].clipX0).toBe(10);
		expect(slices[0].clipX1).toBe(30);
	});

	describe('tiling continuity at shared edges', () => {
		// The midline row (y = the mean of the nominal top/bottom band) is
		// EXACTLY reproduced at both edges of `glyphEnvelopeMatrix`'s fit,
		// regardless of curvature (see that module's doc comment); since
		// adjacent slices sample the curve at the IDENTICAL shared boundary
		// `u`, they must therefore agree, at that boundary, on the midline
		// position to within floating-point precision, not just approximately.
		const meanY = (nomTop * HEIGHT + nomBottom * HEIGHT) / 2;

		it('agrees at every interior boundary for a strongly-curved can preset', () => {
			const x0 = 50;
			const x1 = 250;
			const slices = buildGlyphSlices(
				'textCanUp',
				x0,
				x1,
				0.05,
				0.55,
				66667,
				undefined,
				HEIGHT,
				0,
				1,
				nomTop * HEIGHT,
				nomBottom * HEIGHT,
				6,
			);
			for (let i = 1; i < slices.length; i++) {
				// The boundary x is the un-padded seam: slice i-1's clipX1 minus
				// its own overlap pad, equivalently slice i's un-padded clipX0.
				const boundaryX = x0 + ((x1 - x0) * i) / slices.length;
				const left = evalMatrix(slices[i - 1].transform, boundaryX, meanY);
				const right = evalMatrix(slices[i].transform, boundaryX, meanY);
				expect(Math.abs(left - right)).toBeLessThan(1e-6);
			}
		});

		it('agrees at every interior boundary for inflate at default adj', () => {
			const x0 = 0;
			const x1 = 120;
			const slices = buildGlyphSlices(
				'textInflate',
				x0,
				x1,
				0,
				0.3,
				undefined,
				undefined,
				HEIGHT,
				0,
				1,
				nomTop * HEIGHT,
				nomBottom * HEIGHT,
				5,
			);
			for (let i = 1; i < slices.length; i++) {
				const boundaryX = x0 + ((x1 - x0) * i) / slices.length;
				const left = evalMatrix(slices[i - 1].transform, boundaryX, meanY);
				const right = evalMatrix(slices[i].transform, boundaryX, meanY);
				expect(Math.abs(left - right)).toBeLessThan(1e-6);
			}
		});

		it('agrees across a multi-line band slice (lineIndex/lineCount) too', () => {
			const x0 = 0;
			const x1 = 100;
			const slices = buildGlyphSlices(
				'textInflate',
				x0,
				x1,
				0,
				0.25,
				undefined,
				undefined,
				HEIGHT,
				1,
				2,
				nomTop * HEIGHT,
				nomBottom * HEIGHT,
				4,
			);
			for (let i = 1; i < slices.length; i++) {
				const boundaryX = x0 + ((x1 - x0) * i) / slices.length;
				const left = evalMatrix(slices[i - 1].transform, boundaryX, meanY);
				const right = evalMatrix(slices[i].transform, boundaryX, meanY);
				expect(Math.abs(left - right)).toBeLessThan(1e-6);
			}
		});
	});
});
