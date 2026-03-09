import { describe, it, expect } from 'vitest';
import type { ShapeStyle } from 'pptx-viewer-core';
import {
	sanitizeGradientStops,
	toCssGradientStop,
	buildCssGradientFromShapeStyle,
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
