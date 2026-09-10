import { describe, expect, it } from 'vitest';

import { resolveRingAxisOffset } from './smartart-layout-interpreter-cycle-ring-offset';

describe('resolveRingAxisOffset', () => {
	it("session 16: flushes the LOW extreme to 0 when it is reached by fewer points than the HIGH extreme - pins `radial-cycle--hier5.pptx`'s own measured Y axis (1 satellite alone at the top, 2 tied at the bottom, 400pt box, ~92.3pt item, top margin measured 0.17pt vs bottom 52.68pt)", () => {
		const dimension = 533;
		const boundSize = 462.87; // the fixture's own real content height.
		const scale = 1; // values already in box-local units for this check.
		const values = [0, 350, 350]; // one lone point at the low extreme, two tied at the high extreme.
		const offset = resolveRingAxisOffset(dimension, boundSize, scale, values);
		expect(offset).toBeCloseTo(0, 6); // flush at the low (lone) extreme.
	});

	it('session 16: flushes the HIGH extreme to `dimension - boundSize*scale` when it is reached by fewer points', () => {
		const dimension = 533;
		const boundSize = 462.87;
		const scale = 1;
		const values = [0, 0, 350]; // two tied at the low extreme, one lone at the high extreme.
		const offset = resolveRingAxisOffset(dimension, boundSize, scale, values);
		expect(offset).toBeCloseTo(dimension - boundSize * scale, 6);
	});

	it('centres when both extremes are reached by an equal count of points (n=2, one point per extreme - "basic-cycle--flat3.pptx"\'s own binding axis and "basic-radial--hier5.pptx"\'s n=4 ring, a point at both poles, both reduce to this)', () => {
		const dimension = 533;
		const boundSize = 400;
		const scale = 1;
		const values = [0, 400]; // 1-vs-1 tie on both extremes.
		const offset = resolveRingAxisOffset(dimension, boundSize, scale, values);
		expect(offset).toBeCloseTo((dimension - boundSize * scale) / 2, 6);
	});

	it('centres for a single-point ring (degenerate n=1, tied trivially with itself)', () => {
		const offset = resolveRingAxisOffset(500, 100, 1, [42]);
		expect(offset).toBeCloseTo((500 - 100) / 2, 6);
	});

	it('is a strict generalisation: reduces to the OLD pre-session-16 centred formula exactly whenever counts tie, regardless of scale/boundSize', () => {
		const dimension = 867;
		const boundSize = 579.6;
		const scale = 231.84;
		const tied = [0, 0.866, -0.866]; // symmetric: one point at 0 is neither extreme, the other two tie both extremes.
		const offset = resolveRingAxisOffset(dimension, boundSize, scale, tied);
		expect(offset).toBeCloseTo((dimension - boundSize * scale) / 2, 6);
	});

	it('treats near-tied floating point extremes (within the epsilon tolerance) as a genuine tie, counting both toward that extreme rather than miscounting due to rounding', () => {
		// Two points effectively tied at the LOW extreme (0 and 1e-10, well
		// inside the epsilon tolerance), one point alone at the HIGH extreme:
		// lowCount=2, highCount=1, so the LONE high point flushes to the far
		// edge - proving the epsilon comparison counts the near-duplicate LOW
		// pair together instead of (incorrectly) treating them as 2 distinct
		// singleton extremes.
		const values = [0, 1e-10, 100];
		const dimension = 100;
		const boundSize = 20;
		const scale = 1;
		const offset = resolveRingAxisOffset(dimension, boundSize, scale, values);
		expect(offset).toBeCloseTo(dimension - boundSize * scale, 6); // flush at the high (lone) extreme.
	});
});
