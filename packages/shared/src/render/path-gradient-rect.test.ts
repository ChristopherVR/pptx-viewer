/**
 * Tests for the nested-rectangle-band approximation of a `path="rect"`
 * gradient (see `path-gradient-rect.ts` for why this replaced a single
 * ellipse).
 */
import { describe, expect, it } from 'vitest';

import type { RectPathGradientStop } from './path-gradient-rect';
import { buildRectPathGradientImage, buildRectPathGradientSvg } from './path-gradient-rect';

const whiteToBlack: RectPathGradientStop[] = [
	{ color: '#ffffff', position: 0 },
	{ color: '#000000', position: 100 },
];

/** Parses the `<rect>` elements out of a generated SVG, in draw order (outer to inner). */
function parseRects(
	svg: string,
): Array<{ x: number; y: number; w: number; h: number; fill: string; opacity: number }> {
	const matches = [
		...svg.matchAll(
			/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="([^"]+)"(?: fill-opacity="([^"]+)")?\/>/gu,
		),
	];
	return matches.map((m) => ({
		x: Number(m[1]),
		y: Number(m[2]),
		w: Number(m[3]),
		h: Number(m[4]),
		fill: m[5],
		opacity: m[6] === undefined ? 1 : Number(m[6]),
	}));
}

describe('buildRectPathGradientSvg', () => {
	it('returns an empty SVG for no stops', () => {
		const svg = buildRectPathGradientSvg([]);
		expect(svg).toContain('<svg');
		expect(svg).not.toContain('<rect');
	});

	it('uses a normalised 0-100 viewBox with preserveAspectRatio="none"', () => {
		const svg = buildRectPathGradientSvg(whiteToBlack);
		expect(svg).toContain('viewBox="0 0 100 100"');
		expect(svg).toContain('preserveAspectRatio="none"');
	});

	it('draws concentric square bands centred by default (no fillToRect/focalPoint)', () => {
		const rects = parseRects(buildRectPathGradientSvg(whiteToBlack));
		expect(rects.length).toBeGreaterThan(10);
		// Outer band (first drawn) spans the full box and carries the LAST stop's
		// colour; PowerPoint's rect path gradient runs stop 0 at the centre and
		// the final stop at the outer edge.
		const outer = rects[0];
		expect(outer.x).toBeCloseTo(0, 1);
		expect(outer.y).toBeCloseTo(0, 1);
		expect(outer.w).toBeCloseTo(100, 1);
		expect(outer.h).toBeCloseTo(100, 1);
		expect(outer.fill.toLowerCase()).toBe('#000000');
		// Innermost band (last drawn, painted on top) is a point at dead centre
		// carrying the first stop's colour.
		const inner = rects[rects.length - 1];
		expect(inner.w).toBeCloseTo(0, 1);
		expect(inner.h).toBeCloseTo(0, 1);
		expect(inner.x).toBeCloseTo(50, 1);
		expect(inner.y).toBeCloseTo(50, 1);
		expect(inner.fill.toLowerCase()).toBe('#ffffff');
	});

	it('produces square (not elongated) bands even for an off-square shape, since bands are drawn in the normalised 0-100 box', () => {
		// The 0-100 viewBox is always square; real aspect ratio is applied by the
		// consumer via `background-size: <w>px <h>px` / `100% 100%` stretching the
		// whole image, exactly like the CSS radial-gradient string it replaces.
		const rects = parseRects(buildRectPathGradientSvg(whiteToBlack));
		const outer = rects[0];
		expect(outer.w).toBeCloseTo(outer.h, 1);
	});

	it('every band is a square/rectangle: corners are NOT rounded off the way an ellipse would be', () => {
		// A mid-gradient band's width/height should scale linearly with band
		// index (Chebyshev isolines are literal nested rectangles), unlike an
		// ellipse whose iso-distance curves are never axis-aligned rectangles.
		const rects = parseRects(buildRectPathGradientSvg(whiteToBlack));
		const mid = rects[Math.floor(rects.length / 2)];
		// A band at fractional distance t has side length 100*t; the midpoint
		// band (t ~= 0.5) should have side length close to 50.
		expect(mid.w).toBeCloseTo(50, 0);
		expect(mid.h).toBeCloseTo(50, 0);
	});

	it('shifts the centre toward an authored focal point', () => {
		const rects = parseRects(buildRectPathGradientSvg(whiteToBlack, { x: 0.8, y: 0.2 }));
		const inner = rects[rects.length - 1];
		expect(inner.x).toBeCloseTo(80, 0);
		expect(inner.y).toBeCloseTo(20, 0);
	});

	it('shifts the centre using fillToRect, matching computeGradientCenter semantics', () => {
		// fillToRect l=0, t=0, r=1, b=1 => the inner rect collapses to a point at
		// the shape's top-left corner (a degenerate fillToRect with no width).
		const rects = parseRects(
			buildRectPathGradientSvg(whiteToBlack, undefined, { l: 0, t: 0, r: 1, b: 1 }),
		);
		const inner = rects[rects.length - 1];
		expect(inner.x).toBeCloseTo(0, 0);
		expect(inner.y).toBeCloseTo(0, 0);
	});

	it("always reaches the shape's real bounding box on the outer band, regardless of focal point", () => {
		// PowerPoint's rect path gradient paints its last stop at the shape's
		// actual edges all the way around, not just at the corner farthest from
		// an off-centre focal point (unlike a CSS radial-gradient's sizing
		// keywords, which this module's first draft mirrored and which this test
		// guards against regressing to).
		const rects = parseRects(buildRectPathGradientSvg(whiteToBlack, { x: 0.8, y: 0.5 }));
		const outer = rects[0];
		expect(outer.x).toBeCloseTo(0, 6);
		expect(outer.y).toBeCloseTo(0, 6);
		expect(outer.w).toBeCloseTo(100, 6);
		expect(outer.h).toBeCloseTo(100, 6);
	});

	it("paints fillToRect's own inner rectangle flat, not just its centre point", () => {
		// fillToRect insets of 25% on every side => the inner target rectangle
		// spans the middle 50% of the box (25 to 75 on each axis): the
		// INNERMOST band should have that real size, not collapse to a point.
		const rects = parseRects(
			buildRectPathGradientSvg(whiteToBlack, undefined, { l: 0.25, t: 0.25, r: 0.25, b: 0.25 }),
		);
		const inner = rects[rects.length - 1];
		expect(inner.x).toBeCloseTo(25, 0);
		expect(inner.y).toBeCloseTo(25, 0);
		expect(inner.w).toBeCloseTo(50, 0);
		expect(inner.h).toBeCloseTo(50, 0);
	});

	it('honours a non-square fillToRect (a wide inner target rectangle), unlike an ellipse', () => {
		// l/r insets of 10% but t/b insets of 30% => a WIDE inner rectangle
		// (80 wide, 40 tall): the old ellipse approximation could only hint at
		// this via an elongated ellipse; the real geometry now reproduces it
		// directly.
		const rects = parseRects(
			buildRectPathGradientSvg(whiteToBlack, undefined, { l: 0.1, t: 0.3, r: 0.1, b: 0.3 }),
		);
		const inner = rects[rects.length - 1];
		expect(inner.w).toBeCloseTo(80, 0);
		expect(inner.h).toBeCloseTo(40, 0);
		expect(inner.w).not.toBeCloseTo(inner.h, 0);
	});

	it('carries a middle stop colour on some intermediate band for a 3-stop gradient', () => {
		const stops: RectPathGradientStop[] = [
			{ color: '#ff0000', position: 0 },
			{ color: '#00ff00', position: 50 },
			{ color: '#0000ff', position: 100 },
		];
		const rects = parseRects(buildRectPathGradientSvg(stops));
		const mid = rects[Math.floor(rects.length / 2)];
		// Around the midpoint band the colour should be close to green, not a
		// linear red/blue blend (i.e. the multi-stop shape is honoured).
		const midHex = mid.fill.toLowerCase();
		const g = Number.parseInt(midHex.slice(3, 5), 16);
		expect(g).toBeGreaterThan(150);
	});

	it('applies per-stop opacity as fill-opacity', () => {
		const stops: RectPathGradientStop[] = [
			{ color: '#ff0000', position: 0, opacity: 0.4 },
			{ color: '#0000ff', position: 100 },
		];
		const rects = parseRects(buildRectPathGradientSvg(stops));
		const inner = rects[rects.length - 1];
		expect(inner.opacity).toBeCloseTo(0.4, 1);
	});
});

describe('buildRectPathGradientImage', () => {
	it('returns a CSS url() data URI wrapping the SVG markup', () => {
		const css = buildRectPathGradientImage(whiteToBlack);
		expect(css.startsWith('url("data:image/svg+xml,')).toBeTruthy();
		expect(css.endsWith('")')).toBeTruthy();
		const encoded = css.slice('url("data:image/svg+xml,'.length, -2);
		const decoded = decodeURIComponent(encoded);
		expect(decoded).toContain('<svg');
		expect(decoded).toContain('<rect');
	});
});
