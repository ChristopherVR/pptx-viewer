import { describe, expect, it } from 'vitest';

import type { EnvelopeWarp } from './text-warp-envelope-map';
import type { GlyphOutlineCommand } from './text-warp-glyph-outline';
import {
	buildWarpedGlyphOutlinePathD,
	flattenOutline,
	outlineBounds,
} from './text-warp-glyph-outline';

const SQUARE: GlyphOutlineCommand[] = [
	{ type: 'M', x: 0, y: 0 },
	{ type: 'L', x: 10, y: 0 },
	{ type: 'L', x: 10, y: 10 },
	{ type: 'L', x: 0, y: 10 },
	{ type: 'Z' },
];

describe('flattenOutline', () => {
	it('splits straight lines so no piece is longer than maxSegment', () => {
		const [contour] = flattenOutline(SQUARE, 2.5);
		// 4 sides x 4 pieces each, plus the starting point.
		expect(contour).toHaveLength(17);
		for (let i = 1; i < contour.length; i++) {
			const len = Math.hypot(contour[i].x - contour[i - 1].x, contour[i].y - contour[i - 1].y);
			expect(len).toBeLessThanOrEqual(2.5 + 1e-9);
		}
	});

	it('returns one closed contour per moveTo', () => {
		expect(flattenOutline([...SQUARE, ...SQUARE], 0)).toHaveLength(2);
	});
});

describe('outlineBounds', () => {
	it('covers a quadratic curve by its drawn extent, not its control point', () => {
		const bounds = outlineBounds([
			{ type: 'M', x: 0, y: 0 },
			{ type: 'Q', x1: 5, y1: -10, x: 10, y: 0 },
			{ type: 'Z' },
		])!;
		expect(bounds.top).toBeCloseTo(-5, 6);
		expect(bounds.left).toBe(0);
		expect(bounds.right).toBe(10);
	});

	it('is undefined for an empty outline', () => {
		expect(outlineBounds([])).toBeUndefined();
	});
});

describe('buildWarpedGlyphOutlinePathD', () => {
	const shift: EnvelopeWarp = { map: (x, y) => ({ x: x + 100, y: y * 2 }) };

	it('maps every flattened point through the warp', () => {
		const d = buildWarpedGlyphOutlinePathD(SQUARE, shift, 10)!;
		expect(d).toBe('M100 0L110 0L110 20L100 20L100 0Z');
	});

	it('bends a straight edge when the warp is non-linear', () => {
		const bend: EnvelopeWarp = { map: (x, y) => ({ x, y: y + (x - 5) ** 2 }) };
		const d = buildWarpedGlyphOutlinePathD(
			[{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 10, y: 0 }, { type: 'Z' }],
			bend,
			5,
		)!;
		expect(d.startsWith('M0 25L5 0L10 25')).toBeTruthy();
	});

	it('is undefined for an empty outline (whitespace)', () => {
		expect(buildWarpedGlyphOutlinePathD([], shift, 1)).toBeUndefined();
	});
});
