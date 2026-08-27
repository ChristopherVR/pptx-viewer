import type { ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildCirclePathGradient,
	buildCssGradientFromShapeStyle,
	buildRectPathGradient,
	buildShapePathGradient,
	computeGradientCenter,
	convertOoxmlAngleToCss,
	sanitizeGradientStops,
	toCssGradientStop,
} from './color-gradient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ShapeStyle factory for gradient scenarios. */
function gradientStyle(overrides: Partial<ShapeStyle> = {}): ShapeStyle {
	return {
		fillMode: 'gradient',
		...overrides,
	} as ShapeStyle;
}

// ---------------------------------------------------------------------------
// sanitizeGradientStops
// ---------------------------------------------------------------------------

describe('sanitizeGradientStops', () => {
	it('returns empty array for undefined or empty input', () => {
		expect(sanitizeGradientStops(undefined)).toStrictEqual([]);
		expect(sanitizeGradientStops([])).toStrictEqual([]);
	});

	it('filters out stops with missing or invalid color/position', () => {
		const stops = [
			{ color: '', position: 0 },
			{ color: '   ', position: 50 },
			{ color: '#ff0000', position: Number.NaN },
			{ color: '#00ff00', position: 100 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result).toHaveLength(1);
		expect(result[0].color).toBe('#00ff00');
	});

	it('normalizes hex colors without leading #', () => {
		const stops = [{ color: 'ff0000', position: 0 }] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result[0].color).toBe('#ff0000');
	});

	it('clamps positions to 0-100', () => {
		const stops = [
			{ color: '#ff0000', position: -10 },
			{ color: '#00ff00', position: 150 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result[0].position).toBe(0);
		expect(result[1].position).toBe(100);
	});

	it('sorts stops by ascending position', () => {
		const stops = [
			{ color: '#0000ff', position: 100 },
			{ color: '#ff0000', position: 0 },
			{ color: '#00ff00', position: 50 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result.map((s) => s.position)).toStrictEqual([0, 50, 100]);
	});

	it('clamps opacity to [0, 1] and omits non-finite opacity', () => {
		const stops = [
			{ color: '#ff0000', position: 0, opacity: 2 },
			{ color: '#00ff00', position: 50, opacity: -0.5 },
			{ color: '#0000ff', position: 100, opacity: Number.NaN },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result[0].opacity).toBe(1);
		expect(result[1].opacity).toBe(0);
		expect(result[2].opacity).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// convertOoxmlAngleToCss
// ---------------------------------------------------------------------------

describe('convertOoxmlAngleToCss', () => {
	// `a:lin/@ang` is clockwise from +x, CSS is clockwise from "to top", so the
	// conversion is a quarter turn plus a 0-360 normalisation.
	it('rotates a quarter turn and normalises to 0-360', () => {
		expect(convertOoxmlAngleToCss(90)).toBe(180);
		expect(convertOoxmlAngleToCss(0)).toBe(90);
		expect(convertOoxmlAngleToCss(360)).toBe(90);
		expect(convertOoxmlAngleToCss(-90)).toBe(0);
	});

	it('converts from 60000ths of a degree when alreadyDegrees=false', () => {
		// 5400000 / 60000 = 90 OOXML degrees -> CSS 180deg
		expect(convertOoxmlAngleToCss(5400000, false)).toBe(180);
		// 0 OOXML degrees -> CSS 90deg
		expect(convertOoxmlAngleToCss(0, false)).toBe(90);
	});
});

// ---------------------------------------------------------------------------
// toCssGradientStop
// ---------------------------------------------------------------------------

describe('toCssGradientStop', () => {
	it('renders integer position without decimal', () => {
		expect(toCssGradientStop({ color: '#ff0000', position: 50 })).toBe('#ff0000 50%');
	});

	it('renders fractional position with one decimal place', () => {
		expect(toCssGradientStop({ color: '#ff0000', position: 33.3 })).toBe('#ff0000 33.3%');
	});

	it('applies rgba() when opacity is specified', () => {
		const result = toCssGradientStop({ color: '#ff0000', position: 0, opacity: 0.5 });
		expect(result).toBe('rgba(255, 0, 0, 0.5) 0%');
	});

	it('clamps position to 0-100', () => {
		expect(toCssGradientStop({ color: '#ff0000', position: -5 })).toBe('#ff0000 0%');
		expect(toCssGradientStop({ color: '#ff0000', position: 110 })).toBe('#ff0000 100%');
	});
});

// ---------------------------------------------------------------------------
// computeGradientCenter
// ---------------------------------------------------------------------------

describe('computeGradientCenter', () => {
	it('returns (50, 50) with no arguments', () => {
		expect(computeGradientCenter()).toStrictEqual({ cx: 50, cy: 50 });
	});

	it('returns focal point * 100 when only focalPoint is given', () => {
		expect(computeGradientCenter(undefined, { x: 0.25, y: 0.75 })).toStrictEqual({
			cx: 25,
			cy: 75,
		});
	});

	it('computes midpoint of fillToRect inner rectangle', () => {
		// l=0, t=0, r=0, b=0 → covers entire shape → center at 50%
		expect(computeGradientCenter({ l: 0, t: 0, r: 0, b: 0 })).toStrictEqual({ cx: 50, cy: 50 });
		// l=0.25, t=0.25, r=0.25, b=0.25 → inner rect centered → still 50%
		expect(computeGradientCenter({ l: 0.25, t: 0.25, r: 0.25, b: 0.25 })).toStrictEqual({
			cx: 50,
			cy: 50,
		});
	});

	it('blends fillToRect center with focalPoint when both provided', () => {
		const result = computeGradientCenter({ l: 0, t: 0, r: 0, b: 0 }, { x: 0, y: 0 });
		// center = (50+0)/2=25, cy=(50+0)/2=25
		expect(result).toStrictEqual({ cx: 25, cy: 25 });
	});
});

// ---------------------------------------------------------------------------
// buildCirclePathGradient
// ---------------------------------------------------------------------------

describe('buildCirclePathGradient', () => {
	const stops = [
		{ color: '#ff0000', position: 0 },
		{ color: '#0000ff', position: 100 },
	];

	it('produces radial-gradient(circle at center center, ...) with no positioning', () => {
		const result = buildCirclePathGradient(stops);
		expect(result).toBe('radial-gradient(circle at center center, #ff0000 0%, #0000ff 100%)');
	});

	it('uses explicit percent position when focalPoint is provided', () => {
		const result = buildCirclePathGradient(stops, { x: 0.3, y: 0.7 });
		expect(result).toBe('radial-gradient(circle at 30% 70%, #ff0000 0%, #0000ff 100%)');
	});

	it('includes radius in percent when fillToRect is provided', () => {
		const result = buildCirclePathGradient(stops, undefined, {
			l: 0,
			t: 0,
			r: 0,
			b: 0,
		});
		// center=50,50 → radius = max(50,50,50,50) = 50
		// `circle <percentage>` is invalid CSS; the explicit-size form uses
		// matching ellipse semi-axes so browsers do not drop the declaration.
		expect(result).toBe('radial-gradient(ellipse 50% 50% at 50% 50%, #ff0000 0%, #0000ff 100%)');
	});
});

// ---------------------------------------------------------------------------
// buildRectPathGradient
// ---------------------------------------------------------------------------

/**
 * A `path="rect"` gradient renders as a nested-rectangle SVG data URI, not a
 * CSS `radial-gradient()` (PowerPoint's own rect path gradient has square
 * corners, which no native CSS/SVG radial gradient can express - see
 * `pptx-viewer-shared`'s `path-gradient-rect.ts`). Decode the innermost band
 * (the `a:fillToRect` target rectangle) back out for assertions.
 */
function innerBandOfRectGradient(cssValue: string | undefined): { x: number; y: number } {
	const match = /^url\("data:image\/svg\+xml,(.+)"\)$/u.exec(cssValue ?? '');
	if (!match) {
		throw new Error(`not a rect path gradient image: ${cssValue}`);
	}
	const svg = decodeURIComponent(match[1]);
	const rects = [
		...svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/gu),
	];
	const last = rects[rects.length - 1];
	// The innermost band can have real width/height (a `fillToRect` with room
	// left over defines a genuine flat target rectangle, not just a point), so
	// this returns its centre, not its top-left corner.
	return {
		x: Number(last[1]) + Number(last[3]) / 2,
		y: Number(last[2]) + Number(last[4]) / 2,
	};
}

describe('buildRectPathGradient', () => {
	const stops = [
		{ color: '#ffffff', position: 0 },
		{ color: '#000000', position: 100 },
	];

	it('produces a nested-rectangle SVG image without fillToRect', () => {
		const result = buildRectPathGradient(stops);
		expect(result).toMatch(/^url\("data:image\/svg\+xml,/u);
		expect(result).toContain(encodeURIComponent('#ffffff'));
		expect(result).toContain(encodeURIComponent('#000000'));
	});

	it('uses focal point position without fillToRect', () => {
		const result = buildRectPathGradient(stops, { x: 0.2, y: 0.8 });
		const { x, y } = innerBandOfRectGradient(result);
		expect(x).toBeCloseTo(20, 0);
		expect(y).toBeCloseTo(80, 0);
	});

	it('centers on the shape from a symmetric fillToRect', () => {
		// Symmetric insets => the inner rect collapses to a point at 50%, 50%.
		const result = buildRectPathGradient(stops, undefined, { l: 0, t: 0, r: 0, b: 0 });
		const { x, y } = innerBandOfRectGradient(result);
		expect(x).toBeCloseTo(50, 0);
		expect(y).toBeCloseTo(50, 0);
	});
});

// ---------------------------------------------------------------------------
// buildShapePathGradient
// ---------------------------------------------------------------------------

describe('buildShapePathGradient', () => {
	const stops = [
		{ color: '#ff0000', position: 0 },
		{ color: '#ffff00', position: 100 },
	];

	it('uses farthest-side at center without arguments', () => {
		const result = buildShapePathGradient(stops);
		expect(result).toBe(
			'radial-gradient(farthest-side at center center, #ff0000 0%, #ffff00 100%)',
		);
	});

	it('uses percent position when focalPoint provided', () => {
		const result = buildShapePathGradient(stops, { x: 0.5, y: 0.25 });
		expect(result).toBe('radial-gradient(farthest-side at 50% 25%, #ff0000 0%, #ffff00 100%)');
	});

	it('uses explicit radii when fillToRect has meaningful area', () => {
		const result = buildShapePathGradient(stops, undefined, { l: 0, t: 0, r: 0, b: 0 });
		// center=50,50; semiX=semiY=50; innerHalfW/H=50 equal → no aspect branch
		// semiX>0.5 so uses explicit sizes
		expect(result).toContain('50%');
		expect(result).toContain('at 50%');
	});
});

// ---------------------------------------------------------------------------
// buildCssGradientFromShapeStyle: top-level integration
// ---------------------------------------------------------------------------

describe('buildCssGradientFromShapeStyle', () => {
	it('returns undefined for undefined style', () => {
		expect(buildCssGradientFromShapeStyle(undefined)).toBeUndefined();
	});

	it('returns undefined when fillMode is not gradient', () => {
		expect(buildCssGradientFromShapeStyle(gradientStyle({ fillMode: 'solid' }))).toBeUndefined();
	});

	it('falls back to style.fillGradient when there are no valid stops', () => {
		const style = gradientStyle({ fillGradient: 'linear-gradient(90deg, red, blue)' });
		expect(buildCssGradientFromShapeStyle(style)).toBe('linear-gradient(90deg, red, blue)');
	});

	it('falls back to undefined when fillGradient is also absent', () => {
		const style = gradientStyle();
		expect(buildCssGradientFromShapeStyle(style)).toBeUndefined();
	});

	it('builds linear gradient with stops and angle', () => {
		const style = gradientStyle({
			fillGradientType: 'linear',
			fillGradientAngle: 45,
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toBe('linear-gradient(135deg, #ff0000 0%, #0000ff 100%)');
	});

	it('defaults the OOXML angle to 90 (CSS 180deg) when angle is missing', () => {
		const style = gradientStyle({
			fillGradientType: 'linear',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(buildCssGradientFromShapeStyle(style)).toBe(
			'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)',
		);
	});

	it('defaults to linear gradient type when fillGradientType is absent', () => {
		const style = gradientStyle({
			fillGradientStops: [
				{ color: '#ffffff', position: 0 },
				{ color: '#000000', position: 100 },
			],
		});
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toMatch(/^linear-gradient\(/u);
	});

	it('builds radial/circle gradient', () => {
		const style = gradientStyle({
			fillGradientType: 'radial',
			fillGradientPathType: 'circle',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toMatch(/^radial-gradient\(circle at /u);
	});

	it('builds radial/rect gradient as a nested-rectangle SVG image', () => {
		// PowerPoint's rect path gradient has square corners, which no native
		// CSS/SVG radial gradient can express (see `path-gradient-rect.ts`).
		const style = gradientStyle({
			fillGradientType: 'radial',
			fillGradientPathType: 'rect',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toMatch(/^url\("data:image\/svg\+xml,/u);
	});

	it('builds radial/shape gradient', () => {
		const style = gradientStyle({
			fillGradientType: 'radial',
			fillGradientPathType: 'shape',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toMatch(/^radial-gradient\(farthest-side at /u);
	});

	it('defaults radial path type to circle', () => {
		const style = gradientStyle({
			fillGradientType: 'radial',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toMatch(/^radial-gradient\(circle at /u);
	});

	it('handles stop with opacity producing rgba()', () => {
		const style = gradientStyle({
			fillGradientType: 'linear',
			fillGradientAngle: 0,
			fillGradientStops: [
				{ color: '#ff0000', position: 0, opacity: 0.5 },
				{ color: '#0000ff', position: 100 },
			],
		});
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('rgba(255, 0, 0, 0.5)');
		expect(result).toContain('#0000ff');
	});

	it('sorts unsorted stops before building gradient', () => {
		const style = gradientStyle({
			fillGradientType: 'linear',
			fillGradientAngle: 90,
			fillGradientStops: [
				{ color: '#0000ff', position: 100 },
				{ color: '#ff0000', position: 0 },
			],
		});
		const result = buildCssGradientFromShapeStyle(style);
		// After sorting, red (0%) should appear before blue (100%)
		expect(result).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
	});
});
