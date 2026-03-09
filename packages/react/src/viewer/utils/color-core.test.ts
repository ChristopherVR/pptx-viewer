import { describe, it, expect } from 'vitest';
import {
	normalizeHexColor,
	clampUnitInterval,
	hexToRgbChannels,
	colorWithOpacity,
	clampCropValue,
	buildShadowCssFromShapeStyle,
	buildInnerShadowCssFromShapeStyle,
	createArrayBufferCopy,
} from './color-core';

describe('normalizeHexColor', () => {
	it('should return the color unchanged when already a valid 6-digit hex', () => {
		expect(normalizeHexColor('#FF0000')).toBe('#FF0000');
		expect(normalizeHexColor('#00ff00')).toBe('#00ff00');
		expect(normalizeHexColor('#1a2B3c')).toBe('#1a2B3c');
	});

	it('should add a leading # when missing', () => {
		expect(normalizeHexColor('FF0000')).toBe('#FF0000');
		expect(normalizeHexColor('abcdef')).toBe('#abcdef');
	});

	it('should return the fallback for undefined input', () => {
		const result = normalizeHexColor(undefined);
		expect(result).toBeDefined();
		expect(result.startsWith('#')).toBe(true);
	});

	it('should return the fallback for empty string', () => {
		expect(normalizeHexColor('')).toBeDefined();
	});

	it('should return the fallback for "transparent"', () => {
		const fallback = '#123456';
		expect(normalizeHexColor('transparent', fallback)).toBe(fallback);
	});

	it('should return the custom fallback for invalid hex strings', () => {
		expect(normalizeHexColor('xyz', '#000000')).toBe('#000000');
		expect(normalizeHexColor('#GG0000', '#111111')).toBe('#111111');
		expect(normalizeHexColor('#FFF', '#222222')).toBe('#222222'); // 3-digit hex not accepted
	});

	it('should reject hex strings longer than 6 digits', () => {
		expect(normalizeHexColor('#FF000000', '#000000')).toBe('#000000');
	});
});

describe('clampUnitInterval', () => {
	it('should return value unchanged when within [0, 1]', () => {
		expect(clampUnitInterval(0)).toBe(0);
		expect(clampUnitInterval(0.5)).toBe(0.5);
		expect(clampUnitInterval(1)).toBe(1);
	});

	it('should clamp negative values to 0', () => {
		expect(clampUnitInterval(-0.5)).toBe(0);
		expect(clampUnitInterval(-100)).toBe(0);
	});

	it('should clamp values above 1 to 1', () => {
		expect(clampUnitInterval(1.5)).toBe(1);
		expect(clampUnitInterval(100)).toBe(1);
	});

	it('should handle edge case of exactly 0 and 1', () => {
		expect(clampUnitInterval(0)).toBe(0);
		expect(clampUnitInterval(1)).toBe(1);
	});
});

describe('hexToRgbChannels', () => {
	it('should parse a 6-digit hex string with # prefix', () => {
		const result = hexToRgbChannels('#FF8800');
		expect(result).toEqual({ r: 255, g: 136, b: 0 });
	});

	it('should parse a 6-digit hex string without # prefix', () => {
		const result = hexToRgbChannels('00FF00');
		expect(result).toEqual({ r: 0, g: 255, b: 0 });
	});

	it('should return null for invalid hex strings', () => {
		expect(hexToRgbChannels('xyz')).toBeNull();
		expect(hexToRgbChannels('#FFF')).toBeNull(); // 3-digit not supported
		expect(hexToRgbChannels('')).toBeNull();
	});

	it('should handle black and white', () => {
		expect(hexToRgbChannels('#000000')).toEqual({ r: 0, g: 0, b: 0 });
		expect(hexToRgbChannels('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
	});

	it('should be case-insensitive', () => {
		expect(hexToRgbChannels('#aaBBcc')).toEqual({ r: 170, g: 187, b: 204 });
	});

	it('should handle mid-range values correctly', () => {
		const result = hexToRgbChannels('#808080');
		expect(result).toEqual({ r: 128, g: 128, b: 128 });
	});
});

describe('colorWithOpacity', () => {
	it('should return original color when opacity is undefined', () => {
		expect(colorWithOpacity('#FF0000', undefined)).toBe('#FF0000');
	});

	it('should return rgba string for valid opacity', () => {
		const result = colorWithOpacity('#FF0000', 0.5);
		expect(result).toBe('rgba(255, 0, 0, 0.5)');
	});

	it('should clamp opacity to [0, 1]', () => {
		const result = colorWithOpacity('#FF0000', 1.5);
		expect(result).toBe('rgba(255, 0, 0, 1)');

		const result2 = colorWithOpacity('#FF0000', -0.5);
		expect(result2).toBe('rgba(255, 0, 0, 0)');
	});

	it('should return original color if hex cannot be parsed', () => {
		expect(colorWithOpacity('invalid', 0.5)).toBe('invalid');
	});

	it('should handle full opacity', () => {
		const result = colorWithOpacity('#0000FF', 1);
		expect(result).toBe('rgba(0, 0, 255, 1)');
	});

	it('should handle zero opacity (fully transparent)', () => {
		const result = colorWithOpacity('#0000FF', 0);
		expect(result).toBe('rgba(0, 0, 255, 0)');
	});
});

describe('clampCropValue', () => {
	it('should return 0 for undefined input', () => {
		expect(clampCropValue(undefined)).toBe(0);
	});

	it('should return 0 for NaN', () => {
		expect(clampCropValue(NaN)).toBe(0);
	});

	it('should return 0 for Infinity', () => {
		expect(clampCropValue(Infinity)).toBe(0);
	});

	it('should clamp negative values to 0', () => {
		expect(clampCropValue(-0.5)).toBe(0);
	});

	it('should clamp values above 0.95 to 0.95', () => {
		expect(clampCropValue(1)).toBe(0.95);
		expect(clampCropValue(0.99)).toBe(0.95);
	});

	it('should return valid values unchanged', () => {
		expect(clampCropValue(0.5)).toBe(0.5);
		expect(clampCropValue(0)).toBe(0);
		expect(clampCropValue(0.95)).toBe(0.95);
	});
});

describe('buildShadowCssFromShapeStyle', () => {
	it('should return undefined for undefined style', () => {
		expect(buildShadowCssFromShapeStyle(undefined)).toBeUndefined();
	});

	it('should return undefined when no shadowColor is set', () => {
		expect(buildShadowCssFromShapeStyle({})).toBeUndefined();
	});

	it('should return undefined when shadowColor is "transparent"', () => {
		expect(
			buildShadowCssFromShapeStyle({ shadowColor: 'transparent' }),
		).toBeUndefined();
	});

	it('should build shadow CSS with angle and distance', () => {
		const result = buildShadowCssFromShapeStyle({
			shadowColor: '#000000',
			shadowAngle: 0,
			shadowDistance: 10,
			shadowBlur: 5,
			shadowOpacity: 0.5,
		});
		expect(result).toBeDefined();
		expect(result).toContain('px');
		expect(result).toContain('rgba(0, 0, 0, 0.5)');
	});

	it('should build shadow CSS with direct offsets when no angle/distance', () => {
		const result = buildShadowCssFromShapeStyle({
			shadowColor: '#FF0000',
			shadowOffsetX: 3,
			shadowOffsetY: 4,
			shadowBlur: 8,
			shadowOpacity: 0.7,
		});
		expect(result).toBeDefined();
		expect(result).toContain('3px');
		expect(result).toContain('4px');
		expect(result).toContain('8px');
	});

	it('should use default offsets and blur when not specified', () => {
		const result = buildShadowCssFromShapeStyle({
			shadowColor: '#000000',
		});
		expect(result).toBeDefined();
		// Default offsets are 4px, default blur is 6px
		expect(result).toContain('4px 4px 6px');
	});

	it('should compute correct offsets from angle 90 degrees', () => {
		const result = buildShadowCssFromShapeStyle({
			shadowColor: '#000000',
			shadowAngle: 90,
			shadowDistance: 10,
			shadowBlur: 0,
			shadowOpacity: 1,
		});
		expect(result).toBeDefined();
		// cos(90deg) = ~0, sin(90deg) = 1 => offsetX ~= 0, offsetY = 10
		expect(result).toContain('0px 10px 0px');
	});
});

describe('buildInnerShadowCssFromShapeStyle', () => {
	it('should return undefined for undefined style', () => {
		expect(buildInnerShadowCssFromShapeStyle(undefined)).toBeUndefined();
	});

	it('should return undefined when no inner shadow color is set', () => {
		expect(buildInnerShadowCssFromShapeStyle({})).toBeUndefined();
	});

	it('should return undefined when inner shadow color is transparent', () => {
		expect(
			buildInnerShadowCssFromShapeStyle({
				innerShadowColor: 'transparent',
			}),
		).toBeUndefined();
	});

	it('should build inset shadow CSS with given properties', () => {
		const result = buildInnerShadowCssFromShapeStyle({
			innerShadowColor: '#0000FF',
			innerShadowOffsetX: 2,
			innerShadowOffsetY: 3,
			innerShadowBlur: 5,
			innerShadowOpacity: 0.6,
		});
		expect(result).toBeDefined();
		expect(result!.startsWith('inset ')).toBe(true);
		expect(result).toContain('2px');
		expect(result).toContain('3px');
		expect(result).toContain('5px');
		expect(result).toContain('rgba(0, 0, 255, 0.6)');
	});

	it('should use default values when optional properties are missing', () => {
		const result = buildInnerShadowCssFromShapeStyle({
			innerShadowColor: '#000000',
		});
		expect(result).toBeDefined();
		expect(result!.startsWith('inset ')).toBe(true);
		// Defaults: offset 0, 0, blur 6, opacity 0.5
		expect(result).toContain('0px 0px 6px');
	});
});

describe('createArrayBufferCopy', () => {
	it('should create a copy of the input bytes', () => {
		const original = new Uint8Array([1, 2, 3, 4]);
		const copy = createArrayBufferCopy(original);
		expect(copy.byteLength).toBe(4);
		const view = new Uint8Array(copy);
		expect(view[0]).toBe(1);
		expect(view[3]).toBe(4);
	});

	it('should not share memory with the original', () => {
		const original = new Uint8Array([10, 20, 30]);
		const copy = createArrayBufferCopy(original);
		original[0] = 99;
		const view = new Uint8Array(copy);
		expect(view[0]).toBe(10); // unchanged
	});

	it('should handle empty arrays', () => {
		const original = new Uint8Array(0);
		const copy = createArrayBufferCopy(original);
		expect(copy.byteLength).toBe(0);
	});
});
