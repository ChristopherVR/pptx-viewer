import { describe, it, expect } from 'vitest';

import {
	normalizeHexColor,
	clampUnitInterval,
	hexToRgbChannels,
	colorWithOpacity,
	clampCropValue,
	createArrayBufferCopy,
} from './fill-style';
import {
	buildShadowCssFromShapeStyle,
	buildInnerShadowCssFromShapeStyle,
	buildMultiLayerShadowCss,
	buildGlowBoxShadow,
	buildReflectionCss,
} from './visual-effects';

// Ported from the React `color-core.test.ts` (now a thin shim over shared's
// `fill-style` colour primitives + `visual-effects` shadow/glow/reflection
// builders). Verifies the per-binding alias names and the optional
// default-fallback behaviour of `normalizeHexColor`.

describe('normalizeHexColor', () => {
	it('returns the colour unchanged when already a valid 6-digit hex', () => {
		expect(normalizeHexColor('#FF0000')).toBe('#FF0000');
		expect(normalizeHexColor('#1a2B3c')).toBe('#1a2B3c');
	});

	it('adds a leading # when missing', () => {
		expect(normalizeHexColor('FF0000')).toBe('#FF0000');
	});

	it('returns the default fallback for undefined input (single-arg call site)', () => {
		const result = normalizeHexColor(undefined);
		expect(result).toBe('#111827');
	});

	it('returns the default fallback for empty string', () => {
		expect(normalizeHexColor('')).toBe('#111827');
	});

	it('returns the custom fallback for "transparent"', () => {
		expect(normalizeHexColor('transparent', '#123456')).toBe('#123456');
	});

	it('returns the custom fallback for invalid hex strings', () => {
		expect(normalizeHexColor('xyz', '#000000')).toBe('#000000');
		expect(normalizeHexColor('#FFF', '#222222')).toBe('#222222');
	});

	it('rejects hex strings longer than 6 digits', () => {
		expect(normalizeHexColor('#FF000000', '#000000')).toBe('#000000');
	});
});

describe('clampUnitInterval', () => {
	it('clamps below 0 and above 1', () => {
		expect(clampUnitInterval(-0.5)).toBe(0);
		expect(clampUnitInterval(1.5)).toBe(1);
		expect(clampUnitInterval(0.5)).toBe(0.5);
	});
});

describe('hexToRgbChannels', () => {
	it('parses a 6-digit hex string with or without # prefix', () => {
		expect(hexToRgbChannels('#FF8800')).toStrictEqual({ r: 255, g: 136, b: 0 });
		expect(hexToRgbChannels('00FF00')).toStrictEqual({ r: 0, g: 255, b: 0 });
	});

	it('returns null for invalid hex strings', () => {
		expect(hexToRgbChannels('#FFF')).toBeNull();
		expect(hexToRgbChannels('')).toBeNull();
	});
});

describe('colorWithOpacity', () => {
	it('returns original colour when opacity is undefined', () => {
		expect(colorWithOpacity('#FF0000', undefined)).toBe('#FF0000');
	});

	it('returns an rgba string for valid opacity, clamped to [0, 1]', () => {
		expect(colorWithOpacity('#FF0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
		expect(colorWithOpacity('#FF0000', 1.5)).toBe('rgba(255, 0, 0, 1)');
	});

	it('returns original colour if hex cannot be parsed', () => {
		expect(colorWithOpacity('invalid', 0.5)).toBe('invalid');
	});
});

describe('clampCropValue', () => {
	it('returns 0 for undefined / non-finite input', () => {
		expect(clampCropValue(undefined)).toBe(0);
		expect(clampCropValue(NaN)).toBe(0);
		expect(clampCropValue(Infinity)).toBe(0);
	});

	it('clamps to the [0, 0.95] range', () => {
		expect(clampCropValue(-0.5)).toBe(0);
		expect(clampCropValue(1)).toBe(0.95);
		expect(clampCropValue(0.5)).toBe(0.5);
	});
});

describe('createArrayBufferCopy', () => {
	it('creates a detached copy of the input bytes', () => {
		const original = new Uint8Array([10, 20, 30]);
		const copy = createArrayBufferCopy(original);
		original[0] = 99;
		expect(new Uint8Array(copy)[0]).toBe(10);
	});
});

describe('buildShadowCssFromShapeStyle', () => {
	it('returns undefined when no shadowColor / transparent', () => {
		expect(buildShadowCssFromShapeStyle(undefined)).toBeUndefined();
		expect(buildShadowCssFromShapeStyle({})).toBeUndefined();
		expect(buildShadowCssFromShapeStyle({ shadowColor: 'transparent' })).toBeUndefined();
	});

	it('uses default offsets and blur when not specified', () => {
		expect(buildShadowCssFromShapeStyle({ shadowColor: '#000000' })).toContain('4px 4px 6px');
	});

	it('computes offsets from angle 90 degrees', () => {
		const result = buildShadowCssFromShapeStyle({
			shadowColor: '#000000',
			shadowAngle: 90,
			shadowDistance: 10,
			shadowBlur: 0,
			shadowOpacity: 1,
		});
		expect(result).toContain('0px 10px 0px');
	});
});

describe('buildInnerShadowCssFromShapeStyle', () => {
	it('returns undefined for missing / transparent inner shadow colour', () => {
		expect(buildInnerShadowCssFromShapeStyle({})).toBeUndefined();
		expect(buildInnerShadowCssFromShapeStyle({ innerShadowColor: 'transparent' })).toBeUndefined();
	});

	it('builds an inset shadow with defaults', () => {
		const result = buildInnerShadowCssFromShapeStyle({ innerShadowColor: '#000000' });
		expect(result?.startsWith('inset ')).toBeTruthy();
		expect(result).toContain('0px 0px 6px');
	});
});

describe('buildMultiLayerShadowCss', () => {
	it('returns undefined for empty / missing shadows', () => {
		expect(buildMultiLayerShadowCss({})).toBeUndefined();
		expect(buildMultiLayerShadowCss({ shadows: [] })).toBeUndefined();
	});

	it('builds multiple layers and skips transparent entries', () => {
		const result = buildMultiLayerShadowCss({
			shadows: [
				{ color: 'transparent', opacity: 0.5, blur: 10, angle: 0, distance: 5 },
				{ color: '#000000', opacity: 0.5, blur: 10, angle: 0, distance: 5 },
			],
		});
		const shadowCount = (result?.match(/px rgba/gu) ?? []).length;
		expect(shadowCount).toBe(1);
	});
});

describe('buildGlowBoxShadow', () => {
	it('returns undefined for missing colour / radius', () => {
		expect(buildGlowBoxShadow(undefined, 10, 0.75)).toBeUndefined();
		expect(buildGlowBoxShadow('#FF0000', 0, 0.75)).toBeUndefined();
	});

	it('produces 3 layered shadows with decreasing opacity', () => {
		const result = buildGlowBoxShadow('#FF0000', 30, 1);
		const shadowCount = (result?.match(/0 0 \d+px/gu) ?? []).length;
		expect(shadowCount).toBe(3);
		expect(result).toContain('rgba(255, 0, 0, 1)');
		expect(result).toContain('rgba(255, 0, 0, 0.6)');
		expect(result).toContain('rgba(255, 0, 0, 0.3)');
	});

	it('defaults opacity to 0.75 when undefined', () => {
		expect(buildGlowBoxShadow('#00FF00', 30, undefined)).toContain('rgba(0, 255, 0, 0.75)');
	});
});

describe('buildReflectionCss', () => {
	it('produces a two-stop gradient with no blur', () => {
		const result = buildReflectionCss(5, 0.5, 0, 100, 0);
		expect(result).toContain('below 5px');
		expect(result).toContain('rgba(255,255,255,0) 100px)');
	});

	it('produces a three-stop gradient with blur', () => {
		const result = buildReflectionCss(10, 0.5, 0, 100, 5);
		expect(result).toContain('rgba(255,255,255,0.25)');
		expect(result).toContain('110px)');
	});
});
