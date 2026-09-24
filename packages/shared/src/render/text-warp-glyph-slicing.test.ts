import { describe, expect, it } from 'vitest';

import { createEnvelopeWarp } from './text-warp-envelope-map';
import type { EnvelopeWarp } from './text-warp-envelope-map';
import { fitGlyphEnvelopeAffine, MAX_ENVELOPE_GLYPH_SLICES } from './text-warp-glyph-slicing';

function parseMatrix(transform: string): number[] {
	return /matrix\(([^)]*)\)/u.exec(transform)![1].trim().split(/\s+/u).map(Number);
}

describe('fitGlyphEnvelopeAffine', () => {
	it('reproduces an affine mapping exactly, with no slices', () => {
		const affine: EnvelopeWarp = {
			map: (x, y) => ({ x: 2 * x + 0.5 * y + 3, y: 0.25 * x + 3 * y - 1 }),
		};
		const fit = fitGlyphEnvelopeAffine(affine, { x0: 0, x1: 10, y0: -8, y1: 0 });
		expect(fit.slices).toBeUndefined();
		const [a, b, c, d, e, f] = parseMatrix(fit.transform);
		expect(a).toBeCloseTo(2, 6);
		expect(b).toBeCloseTo(0.25, 6);
		expect(c).toBeCloseTo(0.5, 6);
		expect(d).toBeCloseTo(3, 6);
		expect(e).toBeCloseTo(3, 6);
		expect(f).toBeCloseTo(-1, 6);
	});

	it('leaves a narrow glyph on a gentle envelope as a single affine', () => {
		const warp = createEnvelopeWarp('textInflate', 600, 200, undefined, undefined, {
			left: 0,
			top: -30,
			right: 300,
			bottom: 0,
		})!;
		expect(
			fitGlyphEnvelopeAffine(warp, { x0: 140, x1: 150, y0: -30, y1: 0 }).slices,
		).toBeUndefined();
	});

	it('slices a very wide glyph on a steep cylinder into ordered, tiling bands', () => {
		const warp = createEnvelopeWarp('textCanUp', 600, 200, 66667, undefined, {
			left: 0,
			top: -40,
			right: 120,
			bottom: 0,
		})!;
		const fit = fitGlyphEnvelopeAffine(warp, { x0: 0, x1: 40, y0: -40, y1: 0 });
		const slices = fit.slices!;
		expect(slices.length).toBeGreaterThan(1);
		expect(slices.length).toBeLessThanOrEqual(MAX_ENVELOPE_GLYPH_SLICES);
		expect(slices[0].clipX0).toBeLessThan(0);
		expect(slices.at(-1)!.clipX1).toBeGreaterThan(40);
		for (let i = 1; i < slices.length; i++) {
			expect(slices[i].clipX0).toBeCloseTo(slices[i - 1].clipX1, 9);
			expect(slices[i].clipX0).toBeLessThan(slices[i].clipX1);
		}
	});
});
