import { describe, it, expect } from 'vitest';
import type { ShapeStyle } from 'pptx-viewer-core';
import {
	sanitizeGradientStops,
	toCssGradientStop,
	buildCssGradientFromShapeStyle,
	buildRectPathGradient,
	buildShapePathGradient,
	OOXML_PATTERN_PRESETS,
} from './color-gradient';

describe('sanitizeGradientStops', () => {
	it('should return empty array for undefined input', () => {
		expect(sanitizeGradientStops(undefined)).toEqual([]);
	});

	it('should return empty array for empty array', () => {
		expect(sanitizeGradientStops([])).toEqual([]);
	});

	it('should filter out stops with missing color', () => {
		const stops = [
			{ color: '', position: 50 },
			{ color: '#FF0000', position: 0 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result.length).toBe(1);
		expect(result[0].position).toBe(0);
	});

	it('should filter out stops with non-finite position', () => {
		const stops = [
			{ color: '#FF0000', position: NaN },
			{ color: '#00FF00', position: 50 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result.length).toBe(1);
	});

	it('should sort stops by position ascending', () => {
		const stops = [
			{ color: '#FF0000', position: 100 },
			{ color: '#00FF00', position: 0 },
			{ color: '#0000FF', position: 50 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result[0].position).toBe(0);
		expect(result[1].position).toBe(50);
		expect(result[2].position).toBe(100);
	});

	it('should clamp positions to 0-100 range', () => {
		const stops = [
			{ color: '#FF0000', position: -10 },
			{ color: '#00FF00', position: 150 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result[0].position).toBe(0);
		expect(result[1].position).toBe(100);
	});

	it('should clamp opacity to [0, 1] range when present', () => {
		const stops = [
			{ color: '#FF0000', position: 50, opacity: 1.5 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result[0].opacity).toBe(1);
	});

	it('should leave opacity undefined when not present', () => {
		const stops = [
			{ color: '#FF0000', position: 50 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result[0].opacity).toBeUndefined();
	});

	it('should normalize colors through normalizeHexColor', () => {
		const stops = [
			{ color: 'FF0000', position: 50 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result[0].color).toBe('#FF0000');
	});
});

describe('toCssGradientStop', () => {
	it('should produce color with percentage position', () => {
		const result = toCssGradientStop({ color: '#FF0000', position: 50 });
		expect(result).toBe('#FF0000 50%');
	});

	it('should apply opacity via rgba when specified', () => {
		const result = toCssGradientStop({
			color: '#FF0000',
			position: 25,
			opacity: 0.5,
		});
		expect(result).toContain('rgba(255, 0, 0, 0.5)');
		expect(result).toContain('25%');
	});

	it('should round position to nearest integer', () => {
		const result = toCssGradientStop({ color: '#000000', position: 33.7 });
		expect(result).toBe('#000000 34%');
	});

	it('should clamp position to 0-100', () => {
		const resultLow = toCssGradientStop({ color: '#000000', position: -5 });
		expect(resultLow).toContain('0%');

		const resultHigh = toCssGradientStop({
			color: '#000000',
			position: 120,
		});
		expect(resultHigh).toContain('100%');
	});

	it('should use hex color when no opacity is given', () => {
		const result = toCssGradientStop({ color: '#AABBCC', position: 0 });
		expect(result).toBe('#AABBCC 0%');
	});

	it('should handle 100% position', () => {
		const result = toCssGradientStop({ color: '#000000', position: 100 });
		expect(result).toBe('#000000 100%');
	});
});

describe('buildCssGradientFromShapeStyle', () => {
	it('should return undefined for undefined style', () => {
		expect(buildCssGradientFromShapeStyle(undefined)).toBeUndefined();
	});

	it('should return undefined when fillMode is not gradient', () => {
		expect(
			buildCssGradientFromShapeStyle({ fillMode: 'solid' } as ShapeStyle),
		).toBeUndefined();
	});

	it('should fall back to fillGradient string when stops are empty', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradient: 'linear-gradient(red, blue)',
			fillGradientStops: [],
		};
		expect(buildCssGradientFromShapeStyle(style)).toBe(
			'linear-gradient(red, blue)',
		);
	});

	it('should build linear-gradient with angle and stops', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientAngle: 45,
			fillGradientStops: [
				{ color: '#FF0000', position: 0 },
				{ color: '#0000FF', position: 100 },
			],
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('linear-gradient(45deg');
		expect(result).toContain('#FF0000 0%');
		expect(result).toContain('#0000FF 100%');
	});

	it('should use default 90deg angle when not specified', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#FF0000', position: 0 },
				{ color: '#0000FF', position: 100 },
			],
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('linear-gradient(90deg');
	});

	it('should build radial-gradient when type is radial', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientStops: [
				{ color: '#FFFFFF', position: 0 },
				{ color: '#000000', position: 100 },
			],
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('radial-gradient(circle at center center');
	});

	it('should use focal point for radial gradient when specified', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientFocalPoint: { x: 0.25, y: 0.75 },
			fillGradientStops: [
				{ color: '#FFFFFF', position: 0 },
				{ color: '#000000', position: 100 },
			],
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('radial-gradient(circle at 25% 75%');
	});
});

describe('buildRectPathGradient', () => {
	const stops: NonNullable<ShapeStyle['fillGradientStops']> = [
		{ color: '#FFFFFF', position: 0 },
		{ color: '#000000', position: 100 },
	];

	it('should produce an elliptical radial gradient with percentage sizing', () => {
		const result = buildRectPathGradient(stops);
		expect(result).toContain('radial-gradient(');
		expect(result).toContain('#FFFFFF 0%');
		expect(result).toContain('#000000 100%');
	});

	it('should use fillToRect center for positioning when provided', () => {
		// fillToRect: l=0.5, t=0.5, r=0.5, b=0.5 => center at 50%, 50%
		const result = buildRectPathGradient(stops, undefined, {
			l: 0.5,
			t: 0.5,
			r: 0.5,
			b: 0.5,
		});
		expect(result).toContain('at 50% 50%');
	});

	it('should offset gradient center based on asymmetric fillToRect', () => {
		// fillToRect: l=0, t=0, r=1, b=1 => center at 0%, 0% (top-left)
		const result = buildRectPathGradient(stops, undefined, {
			l: 0,
			t: 0,
			r: 1,
			b: 1,
		});
		expect(result).toContain('at 0% 0%');
	});

	it('should compute ellipse semi-axes from fillToRect for centered gradient', () => {
		// Center at 50,50 -> semiX=50, semiY=50
		const result = buildRectPathGradient(stops, undefined, {
			l: 0.5,
			t: 0.5,
			r: 0.5,
			b: 0.5,
		});
		expect(result).toContain('50% 50% at');
	});

	it('should use larger semi-axis for off-center gradients', () => {
		// fillToRect: l=0.25, t=0.25, r=0.75, b=0.75 => center at 25%, 25%
		// semiX = max(25, 75) = 75, semiY = max(25, 75) = 75
		const result = buildRectPathGradient(stops, undefined, {
			l: 0.25,
			t: 0.25,
			r: 0.75,
			b: 0.75,
		});
		expect(result).toContain('75% 75% at 25% 25%');
	});

	it('should fall back to ellipse with focal point when no fillToRect', () => {
		const result = buildRectPathGradient(stops, { x: 0.3, y: 0.7 });
		expect(result).toContain('radial-gradient(ellipse at 30% 70%');
	});

	it('should fall back to center when neither fillToRect nor focalPoint', () => {
		const result = buildRectPathGradient(stops);
		expect(result).toContain('radial-gradient(ellipse at center center');
	});
});

describe('buildShapePathGradient', () => {
	const stops: NonNullable<ShapeStyle['fillGradientStops']> = [
		{ color: '#FF0000', position: 0 },
		{ color: '#0000FF', position: 100 },
	];

	it('should produce a farthest-side radial gradient', () => {
		const result = buildShapePathGradient(stops);
		expect(result).toContain('radial-gradient(farthest-side');
	});

	it('should use fillToRect center for positioning', () => {
		const result = buildShapePathGradient(stops, undefined, {
			l: 0.5,
			t: 0.5,
			r: 0.5,
			b: 0.5,
		});
		expect(result).toContain('farthest-side at 50% 50%');
	});

	it('should offset gradient center based on asymmetric fillToRect', () => {
		// fillToRect: l=0, t=0, r=1, b=1 => center at 0%, 0%
		const result = buildShapePathGradient(stops, undefined, {
			l: 0,
			t: 0,
			r: 1,
			b: 1,
		});
		expect(result).toContain('farthest-side at 0% 0%');
	});

	it('should use focal point when no fillToRect', () => {
		const result = buildShapePathGradient(stops, { x: 0.6, y: 0.4 });
		expect(result).toContain('farthest-side at 60% 40%');
	});

	it('should default to center when neither fillToRect nor focalPoint', () => {
		const result = buildShapePathGradient(stops);
		expect(result).toContain('farthest-side at center center');
	});

	it('should include gradient stops in output', () => {
		const result = buildShapePathGradient(stops);
		expect(result).toContain('#FF0000 0%');
		expect(result).toContain('#0000FF 100%');
	});
});

describe('buildCssGradientFromShapeStyle - path gradient types', () => {
	const baseStops: ShapeStyle['fillGradientStops'] = [
		{ color: '#FFFFFF', position: 0 },
		{ color: '#000000', position: 100 },
	];

	it('should produce circle radial for default path type', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientStops: baseStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('radial-gradient(circle at');
	});

	it('should produce circle radial for explicit circle path type', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'circle',
			fillGradientStops: baseStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('radial-gradient(circle at');
	});

	it('should produce rect path gradient with fillToRect sizing', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'rect',
			fillGradientFillToRect: { l: 0.5, t: 0.5, r: 0.5, b: 0.5 },
			fillGradientStops: baseStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toBeDefined();
		// Should use percentage-based ellipse sizing
		expect(result).toContain('50% 50% at 50% 50%');
		expect(result).not.toContain('circle');
	});

	it('should produce shape path gradient with farthest-side', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'shape',
			fillGradientStops: baseStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('farthest-side');
		expect(result).not.toContain('circle');
	});

	it('should apply fillToRect to shape path gradient center', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'shape',
			fillGradientFillToRect: { l: 0.25, t: 0.25, r: 0.25, b: 0.25 },
			fillGradientStops: baseStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('farthest-side at 50% 50%');
	});

	it('should use focal point for rect gradient when fillToRect is absent', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'rect',
			fillGradientFocalPoint: { x: 0.3, y: 0.7 },
			fillGradientStops: baseStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		expect(result).toContain('at 30% 70%');
		expect(result).toContain('ellipse');
	});

	it('should handle top-left positioned rect gradient', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'rect',
			fillGradientFillToRect: { l: 0, t: 0, r: 1, b: 1 },
			fillGradientStops: baseStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		// Center should be at 0%, 0%
		expect(result).toContain('at 0% 0%');
		// Semi-axes should be 100% (distance to far edge)
		expect(result).toContain('100% 100% at');
	});

	it('should handle bottom-right positioned rect gradient', () => {
		const style: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'rect',
			fillGradientFillToRect: { l: 1, t: 1, r: 0, b: 0 },
			fillGradientStops: baseStops,
		};
		const result = buildCssGradientFromShapeStyle(style);
		// Center should be at 100%, 100%
		expect(result).toContain('at 100% 100%');
	});

	it('should differentiate output between all three path types', () => {
		const base: ShapeStyle = {
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientFillToRect: { l: 0.5, t: 0.5, r: 0.5, b: 0.5 },
			fillGradientStops: baseStops,
		};

		const circleResult = buildCssGradientFromShapeStyle({
			...base,
			fillGradientPathType: 'circle',
		});
		const rectResult = buildCssGradientFromShapeStyle({
			...base,
			fillGradientPathType: 'rect',
		});
		const shapeResult = buildCssGradientFromShapeStyle({
			...base,
			fillGradientPathType: 'shape',
		});

		// All three should produce different CSS output
		expect(circleResult).not.toBe(rectResult);
		expect(circleResult).not.toBe(shapeResult);
		expect(rectResult).not.toBe(shapeResult);

		// Circle should use "circle at"
		expect(circleResult).toContain('circle at');
		// Rect should use percentage sizing (not circle, not farthest-side)
		expect(rectResult).not.toContain('circle');
		expect(rectResult).not.toContain('farthest-side');
		// Shape should use farthest-side
		expect(shapeResult).toContain('farthest-side');
	});
});

describe('OOXML_PATTERN_PRESETS', () => {
	it('should contain 56 pattern presets', () => {
		expect(OOXML_PATTERN_PRESETS.length).toBe(56);
	});

	it('should contain known pattern presets', () => {
		expect(OOXML_PATTERN_PRESETS).toContain('pct5');
		expect(OOXML_PATTERN_PRESETS).toContain('horz');
		expect(OOXML_PATTERN_PRESETS).toContain('vert');
		expect(OOXML_PATTERN_PRESETS).toContain('cross');
		expect(OOXML_PATTERN_PRESETS).toContain('zigZag');
	});

	it('should not contain duplicates', () => {
		const uniqueSet = new Set(OOXML_PATTERN_PRESETS);
		expect(uniqueSet.size).toBe(OOXML_PATTERN_PRESETS.length);
	});
});
