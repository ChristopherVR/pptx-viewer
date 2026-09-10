import { describe, expect, it } from 'vitest';

import { edgeBandAt } from './text-warp-glyph-matrix';
import type { GlyphOutlineCommand } from './text-warp-glyph-outline';
import {
	buildWarpedGlyphOutlinePathD,
	mapYThroughEnvelopeBand,
	warpEnvelopeOutlinePoint,
} from './text-warp-glyph-outline';

/** Pull every numeric literal out of an SVG path `d` string, in order. */
function parseNumbers(d: string): number[] {
	return (d.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number);
}

describe('mapYThroughEnvelopeBand', () => {
	it('reproduces the untransformed y when the envelope band equals the nominal band (straight-line envelope)', () => {
		// This is the literal "no vertical deformation at this x" case: when a
		// preset's top/bottom curve happens to coincide with the glyph's own
		// nominal band at some x, every outline point at that x must come back
		// unchanged, regardless of preset.
		for (const y of [0, 0.15, 0.5, 0.85, 1, -3, 42]) {
			expect(mapYThroughEnvelopeBand(y, 0, 1, 0, 1)).toBeCloseTo(y, 10);
		}
		// Same identity holds for a non-unit, offset nominal band.
		for (const y of [20, 35, 50, 65, 80]) {
			expect(mapYThroughEnvelopeBand(y, 20, 80, 20, 80)).toBeCloseTo(y, 10);
		}
	});

	it('linearly interpolates a point within the nominal band into the envelope band', () => {
		// Midpoint of [0, 1] maps to the midpoint of [10, 20].
		expect(mapYThroughEnvelopeBand(0.5, 0, 1, 10, 20)).toBeCloseTo(15, 10);
		// A point 25% of the way down nominal maps to 25% of the way down the
		// envelope band.
		expect(mapYThroughEnvelopeBand(0.25, 0, 1, 10, 30)).toBeCloseTo(15, 10);
	});

	it('falls back to edgeTop for a degenerate (zero-height) nominal band', () => {
		expect(mapYThroughEnvelopeBand(5, 10, 10, 100, 200)).toBe(100);
	});
});

describe('warpEnvelopeOutlinePoint: can presets keep glyph height constant', () => {
	// textCanUp/textCanDown model a cylinder: PowerPoint's own guide formulas
	// give the top and bottom curves the SAME radii/sweep, offset only by a
	// constant vertical shift (see text-warp-glyph-outline.ts's module doc and
	// text-warp-preset-definitions.ts's textCanUp/textCanDown entries) - so the
	// band height (bottom - top) must be mathematically constant across the
	// whole line, not just approximately so. This is the physical property
	// "wrapping text around a can preserves the text's own height".
	const HEIGHT = 300;
	const SAMPLE_US = [0, 0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 0.95, 1];

	it.each(['textCanUp', 'textCanDown'])(
		'%s: band height is constant across u (default adj)',
		(preset) => {
			const heights = SAMPLE_US.map((u) => {
				const edge = edgeBandAt(preset, u, undefined, undefined, HEIGHT, 0, 1);
				return edge.bottom - edge.top;
			});
			const first = heights[0];
			for (const h of heights) {
				expect(h).toBeCloseTo(first, 6);
			}
		},
	);

	it.each(['textCanUp', 'textCanDown'])(
		'%s: band height is constant across u (extreme adj)',
		(preset) => {
			const extremeAdj = preset === 'textCanUp' ? 100000 : 0;
			const heights = SAMPLE_US.map((u) => {
				const edge = edgeBandAt(preset, u, extremeAdj, undefined, HEIGHT, 0, 1);
				return edge.bottom - edge.top;
			});
			const first = heights[0];
			for (const h of heights) {
				expect(h).toBeCloseTo(first, 5);
			}
		},
	);

	it('warps two points sharing an x by the SAME constant scale factor for a can preset', () => {
		const width = 200;
		const nomTop = 20;
		const nomBottom = 180;
		const x = 40; // an interior, non-centre x: exercises the per-point (not per-edge) sampling.
		const top = warpEnvelopeOutlinePoint(
			'textCanUp',
			x,
			nomTop,
			width,
			HEIGHT,
			nomTop,
			nomBottom,
			undefined,
			undefined,
			0,
			1,
		);
		const bottom = warpEnvelopeOutlinePoint(
			'textCanUp',
			x,
			nomBottom,
			width,
			HEIGHT,
			nomTop,
			nomBottom,
			undefined,
			undefined,
			0,
			1,
		);
		const edgeAtX = edgeBandAt('textCanUp', x / width, undefined, undefined, HEIGHT, 0, 1);
		expect(bottom.y - top.y).toBeCloseTo(edgeAtX.bottom - edgeAtX.top, 6);
		// x itself is never warped: only vertical position changes.
		expect(top.x).toBe(x);
		expect(bottom.x).toBe(x);
	});
});

describe('warpEnvelopeOutlinePoint', () => {
	it("samples the envelope curve at the POINT'S OWN x, not the glyph centre", () => {
		const width = 200;
		const height = 200;
		const nomTop = 20;
		const nomBottom = 180;
		const leftX = 10;
		const rightX = 190;
		const y = 100;
		const left = warpEnvelopeOutlinePoint(
			'textInflate',
			leftX,
			y,
			width,
			height,
			nomTop,
			nomBottom,
			undefined,
			undefined,
			0,
			1,
		);
		const right = warpEnvelopeOutlinePoint(
			'textInflate',
			rightX,
			y,
			width,
			height,
			nomTop,
			nomBottom,
			undefined,
			undefined,
			0,
			1,
		);
		// textInflate bows outward from centre: a point near either box edge
		// warps less than a point at the centre, and the two edges (symmetric
		// about the centre) should warp by roughly the same amount.
		expect(Math.abs(left.y - y)).toBeGreaterThan(0);
		expect(Math.abs(left.y - y)).toBeCloseTo(Math.abs(right.y - y), 1);
	});

	it('falls back to u = 0.5 for a non-positive width', () => {
		const atZeroWidth = warpEnvelopeOutlinePoint(
			'textInflate',
			999,
			50,
			0,
			200,
			0,
			100,
			undefined,
			undefined,
			0,
			1,
		);
		const edgeAtHalf = edgeBandAt('textInflate', 0.5, undefined, undefined, 200, 0, 1);
		expect(atZeroWidth.y).toBeCloseTo(
			mapYThroughEnvelopeBand(50, 0, 100, edgeAtHalf.top, edgeAtHalf.bottom),
			10,
		);
	});
});

describe('buildWarpedGlyphOutlinePathD', () => {
	const width = 200;
	const height = 200;
	const nomTop = 20;
	const nomBottom = 180;

	it('returns undefined for an empty command list (whitespace glyph)', () => {
		expect(
			buildWarpedGlyphOutlinePathD(
				[],
				'textCanUp',
				width,
				height,
				nomTop,
				nomBottom,
				undefined,
				undefined,
				0,
				1,
			),
		).toBeUndefined();
	});

	it('emits one command letter per input command, in order', () => {
		const commands: GlyphOutlineCommand[] = [
			{ type: 'M', x: 20, y: 180 },
			{ type: 'L', x: 40, y: 20 },
			{ type: 'Q', x1: 60, y1: 20, x: 80, y: 180 },
			{ type: 'C', x1: 100, y1: 20, x2: 140, y2: 20, x: 160, y: 180 },
			{ type: 'Z' },
		];
		const d = buildWarpedGlyphOutlinePathD(
			commands,
			'textCanUp',
			width,
			height,
			nomTop,
			nomBottom,
			undefined,
			undefined,
			0,
			1,
		)!;
		expect(d.startsWith('M')).toBeTruthy();
		expect(d).toContain('L');
		expect(d).toContain('Q');
		expect(d).toContain('C');
		expect(d.endsWith('Z')).toBeTruthy();
	});

	it("maps every point through the curve at that POINT'S OWN x (not a single per-glyph affine)", () => {
		// Two on-curve points at very different x within the same glyph command
		// list must each be warped using the curve sampled at THEIR x - the
		// whole reason outline warping beats a single affine fit across a wide
		// glyph (see text-warp-glyph-slicing.ts's residual note).
		const commands: GlyphOutlineCommand[] = [
			{ type: 'M', x: 10, y: nomTop },
			{ type: 'L', x: 150, y: nomTop },
		];
		const d = buildWarpedGlyphOutlinePathD(
			commands,
			'textInflate',
			width,
			height,
			nomTop,
			nomBottom,
			undefined,
			undefined,
			0,
			1,
		)!;
		const [mx, my, lx, ly] = parseNumbers(d);
		const expectedM = warpEnvelopeOutlinePoint(
			'textInflate',
			10,
			nomTop,
			width,
			height,
			nomTop,
			nomBottom,
			undefined,
			undefined,
			0,
			1,
		);
		const expectedL = warpEnvelopeOutlinePoint(
			'textInflate',
			150,
			nomTop,
			width,
			height,
			nomTop,
			nomBottom,
			undefined,
			undefined,
			0,
			1,
		);
		expect(mx).toBeCloseTo(expectedM.x, 1);
		expect(my).toBeCloseTo(expectedM.y, 1);
		expect(lx).toBeCloseTo(expectedL.x, 1);
		expect(ly).toBeCloseTo(expectedL.y, 1);
		// The two curve samples genuinely differ (inflate bows away from
		// centre): a per-glyph affine sampling only the edges would have
		// missed this if the glyph spanned even wider, which is exactly the
		// residual this module closes.
		expect(my).not.toBeCloseTo(ly, 1);
	});
});
