/**
 * Tests for the path-gradient and pattern-CSS helpers that were consolidated
 * into `fill-style.ts` from the per-binding `color-gradient.ts` /
 * `color-patterns.ts` modules (React + Angular).
 *
 * Covers the three OOXML path gradient types (circle, rect, shape) with
 * fillToRect positioning, focalPoint offsets, and edge cases, plus
 * `buildPatternFillCss` and the `OOXML_PATTERN_PRESETS` table — preserving the
 * coverage previously held by the binding-local colocated tests.
 */
import type { ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildCirclePathGradient,
	buildCssGradientFromShapeStyle,
	buildPatternFillCss,
	buildRectPathGradient,
	buildShapePathGradient,
	computeGradientCenter,
	getPatternSvg,
	OOXML_PATTERN_PRESETS,
} from './fill-style';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const twoStops: NonNullable<ShapeStyle['fillGradientStops']> = [
	{ color: '#FFFFFF', position: 0 },
	{ color: '#000000', position: 100 },
];

const threeStops: NonNullable<ShapeStyle['fillGradientStops']> = [
	{ color: '#FF0000', position: 0 },
	{ color: '#00FF00', position: 50 },
	{ color: '#0000FF', position: 100 },
];

const opacityStops: NonNullable<ShapeStyle['fillGradientStops']> = [
	{ color: '#FF0000', position: 0, opacity: 0.8 },
	{ color: '#0000FF', position: 100, opacity: 0.3 },
];

// ---------------------------------------------------------------------------
// computeGradientCenter
// ---------------------------------------------------------------------------

describe('computeGradientCenter', () => {
	it('defaults to 50/50 when neither fillToRect nor focalPoint given', () => {
		const { cx, cy } = computeGradientCenter();
		expect(cx).toBe(50);
		expect(cy).toBe(50);
	});

	it('uses focalPoint directly when no fillToRect', () => {
		const { cx, cy } = computeGradientCenter(undefined, { x: 0.2, y: 0.8 });
		expect(cx).toBe(20);
		expect(cy).toBe(80);
	});

	it('computes center of fillToRect inner rectangle', () => {
		const { cx, cy } = computeGradientCenter({ l: 0.25, t: 0.25, r: 0.25, b: 0.25 });
		expect(cx).toBe(50);
		expect(cy).toBe(50);
	});

	it('blends fillToRect center with focalPoint', () => {
		const { cx, cy } = computeGradientCenter(
			{ l: 0.25, t: 0.25, r: 0.25, b: 0.25 },
			{ x: 1.0, y: 0.0 },
		);
		expect(cx).toBe(75);
		expect(cy).toBe(25);
	});

	it('handles fillToRect that positions center at top-left', () => {
		const { cx, cy } = computeGradientCenter({ l: 0, t: 0, r: 1, b: 1 });
		expect(cx).toBe(0);
		expect(cy).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// buildCirclePathGradient
// ---------------------------------------------------------------------------

describe('buildCirclePathGradient', () => {
	it('produces a circular radial gradient', () => {
		const result = buildCirclePathGradient(twoStops);
		expect(result).toMatch(/^radial-gradient\(circle/u);
		expect(result).toContain('#FFFFFF 0%');
		expect(result).toContain('#000000 100%');
	});

	it('uses "center" positioning when no focal point or fillToRect', () => {
		const result = buildCirclePathGradient(twoStops);
		expect(result).toContain('circle at center center');
	});

	it('positions gradient at focal point', () => {
		const result = buildCirclePathGradient(twoStops, { x: 0.3, y: 0.7 });
		expect(result).toContain('circle at 30% 70%');
	});

	it('computes radius from fillToRect', () => {
		const result = buildCirclePathGradient(twoStops, undefined, {
			l: 0.5,
			t: 0.5,
			r: 0.5,
			b: 0.5,
		});
		expect(result).toContain('circle 50% at 50% 50%');
	});

	it('uses farthest-edge radius for off-center fillToRect', () => {
		const result = buildCirclePathGradient(twoStops, undefined, {
			l: 0,
			t: 0,
			r: 1,
			b: 1,
		});
		expect(result).toContain('circle 100% at 0% 0%');
	});

	it('includes multiple gradient stops', () => {
		const result = buildCirclePathGradient(threeStops);
		expect(result).toContain('#FF0000 0%');
		expect(result).toContain('#00FF00 50%');
		expect(result).toContain('#0000FF 100%');
	});
});

// ---------------------------------------------------------------------------
// buildRectPathGradient
// ---------------------------------------------------------------------------

describe('buildRectPathGradient', () => {
	it('produces elliptical gradient with "ellipse" keyword for rect type', () => {
		const result = buildRectPathGradient(twoStops);
		expect(result).toContain('radial-gradient(ellipse at');
	});

	it('centers gradient from fillToRect LTRB fractions', () => {
		const result = buildRectPathGradient(twoStops, undefined, {
			l: 0.2,
			t: 0.3,
			r: 0.2,
			b: 0.3,
		});
		expect(result).toContain('at 50% 50%');
	});

	it('handles edge-value fillToRect (all zeros)', () => {
		const result = buildRectPathGradient(twoStops, undefined, {
			l: 0,
			t: 0,
			r: 0,
			b: 0,
		});
		expect(result).toContain('at 50% 50%');
		expect(result).toContain('50% 50% at');
	});

	it('handles edge-value fillToRect (all ones)', () => {
		const result = buildRectPathGradient(twoStops, undefined, {
			l: 1,
			t: 1,
			r: 1,
			b: 1,
		});
		expect(result).toContain('at 50% 50%');
	});

	it('uses focalPoint offset when combined with fillToRect', () => {
		const result = buildRectPathGradient(
			twoStops,
			{ x: 0.0, y: 0.0 },
			{ l: 0.25, t: 0.25, r: 0.25, b: 0.25 },
		);
		expect(result).toContain('at 25% 25%');
	});
});

// ---------------------------------------------------------------------------
// buildShapePathGradient
// ---------------------------------------------------------------------------

describe('buildShapePathGradient', () => {
	it('produces a radial gradient (not circle) for shape type', () => {
		const result = buildShapePathGradient(twoStops);
		expect(result).toMatch(/^radial-gradient\(/u);
		expect(result).not.toContain('circle');
	});

	it('uses farthest-side when no fillToRect', () => {
		const result = buildShapePathGradient(twoStops);
		expect(result).toContain('farthest-side');
	});

	it('uses bounding-box radii when fillToRect is provided', () => {
		const result = buildShapePathGradient(twoStops, undefined, {
			l: 0.25,
			t: 0.25,
			r: 0.25,
			b: 0.25,
		});
		expect(result).not.toContain('farthest-side');
		expect(result).toContain('50% 50% at 50% 50%');
	});

	it('uses focalPoint to offset gradient center', () => {
		const result = buildShapePathGradient(twoStops, { x: 0.7, y: 0.3 });
		expect(result).toContain('farthest-side at 70% 30%');
	});

	it('blends focalPoint with fillToRect center', () => {
		const result = buildShapePathGradient(
			twoStops,
			{ x: 0.0, y: 1.0 },
			{ l: 0.25, t: 0.25, r: 0.25, b: 0.25 },
		);
		expect(result).toContain('at 25% 75%');
	});

	it('scales radii by aspect ratio for non-square fillToRect', () => {
		const result = buildShapePathGradient(twoStops, undefined, {
			l: 0.1,
			t: 0.3,
			r: 0.1,
			b: 0.3,
		});
		expect(result).toContain('100% 50% at 50% 50%');
	});

	it('handles gradient with opacity stops', () => {
		const result = buildShapePathGradient(opacityStops);
		expect(result).toContain('rgba(');
		expect(result).toContain('0%');
		expect(result).toContain('100%');
	});

	it('handles multiple gradient stops', () => {
		const result = buildShapePathGradient(threeStops, undefined, {
			l: 0.2,
			t: 0.2,
			r: 0.2,
			b: 0.2,
		});
		expect(result).toContain('#FF0000 0%');
		expect(result).toContain('#00FF00 50%');
		expect(result).toContain('#0000FF 100%');
	});
});

// ---------------------------------------------------------------------------
// buildCssGradientFromShapeStyle — path type integration
// ---------------------------------------------------------------------------

describe('buildCssGradientFromShapeStyle path integration', () => {
	it('returns undefined for empty stops', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'shape',
			fillGradientStops: [],
		};
		expect(buildCssGradientFromShapeStyle(style)).toBeUndefined();
	});

	it('uses circle path via buildCirclePathGradient', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'circle',
			fillGradientFocalPoint: { x: 0.5, y: 0.5 },
			fillGradientStops: twoStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('circle');
		expect(result).toContain('50%');
	});

	it('applies fillToRect to circle path gradient', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'circle',
			fillGradientFillToRect: { l: 0, t: 0, r: 1, b: 1 },
			fillGradientStops: twoStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('circle');
		expect(result).toContain('at 0% 0%');
	});

	it('produces distinct outputs for circle vs rect vs shape', () => {
		const makeStyle = (pathType: 'circle' | 'rect' | 'shape'): ShapeStyle => ({
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: pathType,
			fillGradientFocalPoint: { x: 0.3, y: 0.7 },
			fillGradientStops: twoStops,
		});

		expect(buildCssGradientFromShapeStyle(makeStyle('circle'))).toContain('circle');
		expect(buildCssGradientFromShapeStyle(makeStyle('rect'))).toContain('ellipse');
		expect(buildCssGradientFromShapeStyle(makeStyle('shape'))).toContain('farthest-side');
	});
});

// ---------------------------------------------------------------------------
// buildPatternFillCss + OOXML_PATTERN_PRESETS
// ---------------------------------------------------------------------------

describe('buildPatternFillCss', () => {
	it('returns undefined when style is missing or not a pattern fill', () => {
		expect(buildPatternFillCss(undefined)).toBeUndefined();
		expect(buildPatternFillCss({ fillMode: 'solid' })).toBeUndefined();
		expect(buildPatternFillCss({ fillMode: 'pattern' })).toBeUndefined();
	});

	it('returns undefined for an unknown preset', () => {
		expect(
			buildPatternFillCss({ fillMode: 'pattern', fillPatternPreset: 'bogus' }),
		).toBeUndefined();
	});

	it('builds a data-URI background image and background colour', () => {
		const result = buildPatternFillCss({
			fillMode: 'pattern',
			fillPatternPreset: 'pct50',
			fillColor: '#ff0000',
			fillPatternBackgroundColor: '#0000ff',
		});
		expect(result?.backgroundImage).toContain('data:image/svg+xml,');
		expect(result?.backgroundColor).toBe('#0000ff');
	});

	it('normalises bare colour strings before building the SVG', () => {
		const result = buildPatternFillCss({
			fillMode: 'pattern',
			fillPatternPreset: 'cross',
			fillColor: 'ff0000',
			fillPatternBackgroundColor: 'ffffff',
		});
		expect(result?.backgroundColor).toBe('#ffffff');
		expect(result?.backgroundImage).toContain('data:image/svg+xml,');
	});
});

describe('oOXML_PATTERN_PRESETS table', () => {
	it('lists 56 presets, each producing SVG markup', () => {
		expect(OOXML_PATTERN_PRESETS).toHaveLength(56);
		for (const preset of OOXML_PATTERN_PRESETS) {
			const svgMarkup = getPatternSvg(preset, '#000000', '#ffffff');
			expect(svgMarkup, `preset ${preset} should produce SVG`).not.toBeNull();
			expect(svgMarkup).toContain('<svg');
		}
	});
});
