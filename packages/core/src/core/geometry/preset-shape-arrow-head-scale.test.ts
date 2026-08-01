/**
 * Arrow-family head length is measured against `ss`, the short side.
 *
 * ISO/IEC 29500-1 §20.1.9 derives every block arrow's head from `ss`
 * (`min(w, h)`), never from `w`/`h` alone, and pins `adj2` to
 * `maxAdj2 = 100000 * w / ss` so the head can grow to the full length of the
 * shape but no further. Scaling the head off `w` instead makes a long, thin
 * arrow's head swallow half the shape: the reporter's deck for issue #132 has
 * an 8792048 x 256208 EMU `rightArrow` whose head should occupy 1.5% of the
 * width and occupied 50%.
 */
import { describe, expect, it } from 'vitest';

import { evaluatePresetShape } from './preset-shape-evaluator';

/** Every x/y coordinate pair in an evaluated `path(...)` string. */
function points(pathData: string): Array<[number, number]> {
	return [...pathData.matchAll(/(-?[\d.]+)[ ,]+(-?[\d.]+)/gu)].map(([, x, y]) => [
		Number(x),
		Number(y),
	]);
}

describe('block arrow head length scales off the short side', () => {
	it('keeps a wide rightArrow head proportional to its shaft', () => {
		// The reporter's arrow, in px: 923 x 27 with adj1=51382, adj2=50000.
		const result = evaluatePresetShape('rightArrow', 923, 27, { adj1: 51382, adj2: 50000 });
		expect(result).toBeDefined();

		// dx1 = ss * adj2 / 100000 = 27 * 0.5 = 13.5, so the head starts at
		// r - 13.5 = 909.5. Measuring off `w` put it at 461.5, halfway.
		const xs = points(result!.svgPath).map(([x]) => x);
		expect(Math.min(...xs)).toBe(0);
		expect(Math.max(...xs)).toBeCloseTo(923, 3);
		const headStart = Math.max(...xs.filter((x) => x < 923));
		expect(headStart).toBeCloseTo(909.5, 3);
	});

	it('leaves a square rightArrow unchanged', () => {
		// When w === h, `ss` IS `w`, so the historical behaviour is preserved and
		// the default arrow still points from the midpoint.
		const result = evaluatePresetShape('rightArrow', 100, 100, { adj1: 50000, adj2: 50000 });
		const xs = points(result!.svgPath).map(([x]) => x);
		expect(Math.max(...xs.filter((x) => x < 100))).toBeCloseTo(50, 3);
	});

	it('pins adj2 so the head cannot grow past the shape', () => {
		// maxAdj2 = 100000 * w / ss = 100000 * 400 / 40 = 1000000. An authored
		// adj2 beyond that clamps to a head exactly `w` long rather than running
		// off the left edge into negative coordinates.
		const result = evaluatePresetShape('rightArrow', 400, 40, { adj1: 50000, adj2: 5000000 });
		const xs = points(result!.svgPath).map(([x]) => x);
		expect(Math.min(...xs)).toBeCloseTo(0, 3);
	});

	it.each([
		['leftArrow', 923, 27],
		['stripedRightArrow', 923, 27],
		['notchedRightArrow', 923, 27],
	] as const)('%s keeps its head within one short side of the tip', (name, w, h) => {
		const result = evaluatePresetShape(name, w, h, { adj1: 50000, adj2: 50000 });
		expect(result).toBeDefined();
		const xs = points(result!.svgPath).map(([x]) => x);
		const span = Math.max(...xs) - Math.min(...xs);
		expect(span).toBeCloseTo(w, 3);
		// The head is at most `ss` deep, so no interior vertex sits more than
		// `ss` from the tip. Measuring off `w` produced a head w/2 deep.
		const interior = xs.filter((x) => x > 0.01 && x < w - 0.01);
		const deepest =
			name === 'leftArrow'
				? Math.max(...interior)
				: w - Math.min(...interior.filter((x) => x > w / 2));
		expect(deepest).toBeLessThanOrEqual(h + 0.01);
	});

	it('scales upArrow and downArrow heads off the short side too', () => {
		// Tall and narrow: 27 x 923. The head is `ss` = 27 deep.
		for (const name of ['upArrow', 'downArrow'] as const) {
			const result = evaluatePresetShape(name, 27, 923, { adj1: 50000, adj2: 50000 });
			const ys = points(result!.svgPath).map(([, y]) => y);
			const interior = ys.filter((y) => y > 0.01 && y < 923 - 0.01);
			const depth = name === 'upArrow' ? Math.min(...interior) : 923 - Math.max(...interior);
			expect(depth).toBeCloseTo(13.5, 3);
		}
	});

	it('keeps a wide chevron pointed rather than shallow', () => {
		// 400 x 40 chevron: the point is `ss * adj / 100000` = 20 deep, not 200.
		const result = evaluatePresetShape('chevron', 400, 40, { adj: 50000 });
		const xs = points(result!.svgPath).map(([x]) => x);
		expect(Math.min(...xs.filter((x) => x > 0.01))).toBeCloseTo(20, 3);
		expect(Math.max(...xs.filter((x) => x < 399.99))).toBeCloseTo(380, 3);
	});

	it('keeps a wide homePlate point proportional', () => {
		const result = evaluatePresetShape('homePlate', 400, 40, { adj: 50000 });
		const xs = points(result!.svgPath).map(([x]) => x);
		expect(Math.max(...xs.filter((x) => x < 399.99))).toBeCloseTo(380, 3);
	});
});
