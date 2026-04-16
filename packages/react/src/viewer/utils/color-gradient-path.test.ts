/**
 * Tests for gradient path fill rendering improvements.
 *
 * Covers the three OOXML path gradient types (circle, rect, shape) with
 * fillToRect positioning, focalPoint offsets, and edge cases.
 */
import type { ShapeStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	buildCirclePathGradient,
	buildRectPathGradient,
	buildShapePathGradient,
	buildCssGradientFromShapeStyle,
	computeGradientCenter,
} from './color-gradient';

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
	it('should default to 50/50 when neither fillToRect nor focalPoint given', () => {
		const { cx, cy } = computeGradientCenter();
		expect(cx).toBe(50);
		expect(cy).toBe(50);
	});

	it('should use focalPoint directly when no fillToRect', () => {
		const { cx, cy } = computeGradientCenter(undefined, { x: 0.2, y: 0.8 });
		expect(cx).toBe(20);
		expect(cy).toBe(80);
	});

	it('should compute center of fillToRect inner rectangle', () => {
		// l=0.25, t=0.25, r=0.25, b=0.25 => inner rect from 0.25 to 0.75
		// center = (0.25 + 0.75) / 2 = 0.5 => 50%
		const { cx, cy } = computeGradientCenter({ l: 0.25, t: 0.25, r: 0.25, b: 0.25 });
		expect(cx).toBe(50);
		expect(cy).toBe(50);
	});

	it('should blend fillToRect center with focalPoint', () => {
		// fillToRect center at 50%, 50%; focalPoint at 100%, 0%
		// blended = ((50 + 100)/2, (50 + 0)/2) = (75, 25)
		const { cx, cy } = computeGradientCenter(
			{ l: 0.25, t: 0.25, r: 0.25, b: 0.25 },
			{ x: 1.0, y: 0.0 },
		);
		expect(cx).toBe(75);
		expect(cy).toBe(25);
	});

	it('should handle fillToRect that positions center at top-left', () => {
		// l=0, t=0, r=1, b=1 => center at (0 + 0)/2 = 0%
		const { cx, cy } = computeGradientCenter({ l: 0, t: 0, r: 1, b: 1 });
		expect(cx).toBe(0);
		expect(cy).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// buildCirclePathGradient
// ---------------------------------------------------------------------------

describe('buildCirclePathGradient', () => {
	it('should produce a circular radial gradient', () => {
		const result = buildCirclePathGradient(twoStops);
		expect(result).toMatch(/^radial-gradient\(circle/);
		expect(result).toContain('#FFFFFF 0%');
		expect(result).toContain('#000000 100%');
	});

	it('should use "center" positioning when no focal point or fillToRect', () => {
		const result = buildCirclePathGradient(twoStops);
		expect(result).toContain('circle at center center');
	});

	it('should position gradient at focal point', () => {
		const result = buildCirclePathGradient(twoStops, { x: 0.3, y: 0.7 });
		expect(result).toContain('circle at 30% 70%');
	});

	it('should compute radius from fillToRect', () => {
		// Center at 50%, 50% => radius = max(50, 50, 50, 50) = 50
		const result = buildCirclePathGradient(twoStops, undefined, {
			l: 0.5,
			t: 0.5,
			r: 0.5,
			b: 0.5,
		});
		expect(result).toContain('circle 50% at 50% 50%');
	});

	it('should use farthest-edge radius for off-center fillToRect', () => {
		// l=0, t=0, r=1, b=1 => center at 0%, 0% => radius = max(0, 100, 0, 100) = 100
		const result = buildCirclePathGradient(twoStops, undefined, {
			l: 0,
			t: 0,
			r: 1,
			b: 1,
		});
		expect(result).toContain('circle 100% at 0% 0%');
	});

	it('should include multiple gradient stops', () => {
		const result = buildCirclePathGradient(threeStops);
		expect(result).toContain('#FF0000 0%');
		expect(result).toContain('#00FF00 50%');
		expect(result).toContain('#0000FF 100%');
	});
});

// ---------------------------------------------------------------------------
// buildRectPathGradient - fillToRect and focalPoint
// ---------------------------------------------------------------------------

describe('buildRectPathGradient - path fill improvements', () => {
	it('should produce elliptical gradient with "ellipse" keyword for rect type', () => {
		const result = buildRectPathGradient(twoStops);
		expect(result).toContain('radial-gradient(ellipse at');
	});

	it('should center gradient from fillToRect LTRB fractions', () => {
		// l=0.2, t=0.3, r=0.2, b=0.3 => cx = ((0.2 + 0.8)/2)*100 = 50%
		const result = buildRectPathGradient(twoStops, undefined, {
			l: 0.2,
			t: 0.3,
			r: 0.2,
			b: 0.3,
		});
		expect(result).toContain('at 50% 50%');
	});

	it('should handle edge-value fillToRect (all zeros)', () => {
		// l=0, t=0, r=0, b=0 => center at 50%, 50%
		const result = buildRectPathGradient(twoStops, undefined, {
			l: 0,
			t: 0,
			r: 0,
			b: 0,
		});
		expect(result).toContain('at 50% 50%');
		// semiX = max(50, 50) = 50, semiY = max(50, 50) = 50
		expect(result).toContain('50% 50% at');
	});

	it('should handle edge-value fillToRect (all ones)', () => {
		// l=1, t=1, r=1, b=1 => cx = ((1 + 0)/2)*100 = 50%
		// This is a degenerate case: inner rect has negative dimensions
		const result = buildRectPathGradient(twoStops, undefined, {
			l: 1,
			t: 1,
			r: 1,
			b: 1,
		});
		expect(result).toContain('at 50% 50%');
	});

	it('should use focalPoint offset when combined with fillToRect', () => {
		// fillToRect center at 50%, 50%; focalPoint at 0%, 0%
		// blended = (25%, 25%)
		const result = buildRectPathGradient(
			twoStops,
			{ x: 0.0, y: 0.0 },
			{ l: 0.25, t: 0.25, r: 0.25, b: 0.25 },
		);
		expect(result).toContain('at 25% 25%');
	});
});

// ---------------------------------------------------------------------------
// buildShapePathGradient - path fill improvements
// ---------------------------------------------------------------------------

describe('buildShapePathGradient - path fill improvements', () => {
	it('should produce a radial gradient (not circle) for shape type', () => {
		const result = buildShapePathGradient(twoStops);
		expect(result).toMatch(/^radial-gradient\(/);
		expect(result).not.toContain('circle');
	});

	it('should use farthest-side when no fillToRect', () => {
		const result = buildShapePathGradient(twoStops);
		expect(result).toContain('farthest-side');
	});

	it('should use bounding-box radii when fillToRect is provided', () => {
		const result = buildShapePathGradient(twoStops, undefined, {
			l: 0.25,
			t: 0.25,
			r: 0.25,
			b: 0.25,
		});
		// Should use explicit percentage radii, not farthest-side
		expect(result).not.toContain('farthest-side');
		expect(result).toContain('50% 50% at 50% 50%');
	});

	it('should use focalPoint to offset gradient center', () => {
		const result = buildShapePathGradient(twoStops, { x: 0.7, y: 0.3 });
		expect(result).toContain('farthest-side at 70% 30%');
	});

	it('should blend focalPoint with fillToRect center', () => {
		// fillToRect center at 50%, focalPoint at 0%, 100%
		// blended = (25%, 75%)
		const result = buildShapePathGradient(
			twoStops,
			{ x: 0.0, y: 1.0 },
			{ l: 0.25, t: 0.25, r: 0.25, b: 0.25 },
		);
		expect(result).toContain('at 25% 75%');
	});

	it('should scale radii by aspect ratio for non-square fillToRect', () => {
		// l=0.1, t=0.3, r=0.1, b=0.3 => inner 80% x 40%
		// halfW=40, halfH=20, aspect=2
		const result = buildShapePathGradient(twoStops, undefined, {
			l: 0.1,
			t: 0.3,
			r: 0.1,
			b: 0.3,
		});
		// adjustedSemiX = max(50, 50*2) = 100, adjustedSemiY = max(50, 50/2) = 50
		expect(result).toContain('100% 50% at 50% 50%');
	});

	it('should handle gradient with opacity stops', () => {
		const result = buildShapePathGradient(opacityStops);
		// Opacity stops should produce rgba() color values
		expect(result).toContain('rgba(');
		expect(result).toContain('0%');
		expect(result).toContain('100%');
	});

	it('should handle multiple gradient stops', () => {
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
// buildCssGradientFromShapeStyle - path type integration
// ---------------------------------------------------------------------------

describe('buildCssGradientFromShapeStyle - path gradient integration', () => {
	it('should return undefined for empty stops', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'shape',
			fillGradientStops: [],
		};
		expect(buildCssGradientFromShapeStyle(style)).toBeUndefined();
	});

	it('should use circle path via buildCirclePathGradient', () => {
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

	it('should apply fillToRect to circle path gradient', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'circle',
			fillGradientFillToRect: { l: 0, t: 0, r: 1, b: 1 },
			fillGradientStops: twoStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		// fillToRect positions center at top-left
		expect(result).toContain('circle');
		expect(result).toContain('at 0% 0%');
	});

	it('should produce distinct outputs for circle vs rect vs shape', () => {
		const makeStyle = (pathType: 'circle' | 'rect' | 'shape'): ShapeStyle => ({
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: pathType,
			fillGradientFocalPoint: { x: 0.3, y: 0.7 },
			fillGradientStops: twoStops,
		});

		const circleResult = buildCssGradientFromShapeStyle(makeStyle('circle'));
		const rectResult = buildCssGradientFromShapeStyle(makeStyle('rect'));
		const shapeResult = buildCssGradientFromShapeStyle(makeStyle('shape'));

		// Circle uses 'circle' keyword
		expect(circleResult).toContain('circle');
		// Rect uses 'ellipse' keyword
		expect(rectResult).toContain('ellipse');
		// Shape uses 'farthest-side'
		expect(shapeResult).toContain('farthest-side');
	});
});
