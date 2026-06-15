import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildGradientCss,
	buildPatternFill,
	getComputedFillStyle,
	getPatternSvg,
	sanitizeGradientStops,
	toCssGradientStop,
	convertOoxmlAngleToCss,
	colorWithOpacity,
	normalizeHexColor,
} from './fill-style';

function shape(shapeStyle?: ShapeStyle, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle,
		...overrides,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// Color primitives
// ---------------------------------------------------------------------------

describe('normalizeHexColor', () => {
	it('passes through valid hex', () => {
		expect(normalizeHexColor('#aabbcc', '#000000')).toBe('#aabbcc');
	});
	it('prefixes a missing hash', () => {
		expect(normalizeHexColor('aabbcc', '#000000')).toBe('#aabbcc');
	});
	it('falls back for transparent / invalid / missing', () => {
		expect(normalizeHexColor('transparent', '#123456')).toBe('#123456');
		expect(normalizeHexColor('nope', '#123456')).toBe('#123456');
		expect(normalizeHexColor(undefined, '#123456')).toBe('#123456');
	});
});

describe('colorWithOpacity', () => {
	it('returns hex unchanged when opacity is undefined', () => {
		expect(colorWithOpacity('#ff0000', undefined)).toBe('#ff0000');
	});
	it('produces rgba with clamped opacity', () => {
		expect(colorWithOpacity('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
		expect(colorWithOpacity('#00ff00', 2)).toBe('rgba(0, 255, 0, 1)');
	});
});

describe('convertOoxmlAngleToCss', () => {
	it('normalizes degrees into 0-360', () => {
		expect(convertOoxmlAngleToCss(370)).toBe(10);
		expect(convertOoxmlAngleToCss(-10)).toBe(350);
	});
	it('converts 60000ths when alreadyDegrees is false', () => {
		expect(convertOoxmlAngleToCss(60000 * 90, false)).toBe(90);
	});
});

// ---------------------------------------------------------------------------
// Gradient stops
// ---------------------------------------------------------------------------

describe('sanitizeGradientStops', () => {
	it('returns [] for undefined / empty', () => {
		expect(sanitizeGradientStops(undefined)).toStrictEqual([]);
		expect(sanitizeGradientStops([])).toStrictEqual([]);
	});
	it('filters invalid stops and sorts ascending', () => {
		const stops = [
			{ color: '#ff0000', position: 100 },
			{ color: '', position: 0 },
			{ color: '#00ff00', position: 0 },
			{ color: '#0000ff', position: Number.NaN },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result).toHaveLength(2);
		expect(result[0].position).toBe(0);
		expect(result[1].position).toBe(100);
	});
	it('clamps positions and opacity', () => {
		const stops = [
			{ color: '#ff0000', position: -10, opacity: 1.5 },
			{ color: '#00ff00', position: 150 },
		] as ShapeStyle['fillGradientStops'];
		const result = sanitizeGradientStops(stops);
		expect(result[0].position).toBe(0);
		expect(result[0].opacity).toBe(1);
		expect(result[1].position).toBe(100);
		expect(result[1].opacity).toBeUndefined();
	});
});

describe('toCssGradientStop', () => {
	it('renders integer percentages without decimals', () => {
		expect(toCssGradientStop({ color: '#ff0000', position: 50 })).toBe('#ff0000 50%');
	});
	it('renders fractional percentages with one decimal', () => {
		expect(toCssGradientStop({ color: '#ff0000', position: 33.33 })).toBe('#ff0000 33.3%');
	});
	it('applies opacity as rgba', () => {
		expect(toCssGradientStop({ color: '#ff0000', position: 0, opacity: 0.5 })).toBe(
			'rgba(255, 0, 0, 0.5) 0%',
		);
	});
});

// ---------------------------------------------------------------------------
// buildGradientCss
// ---------------------------------------------------------------------------

describe('buildGradientCss', () => {
	it('returns undefined when not a gradient fill', () => {
		expect(buildGradientCss(undefined)).toBeUndefined();
		expect(buildGradientCss({ fillMode: 'solid' })).toBeUndefined();
	});

	it('falls back to the prebuilt fillGradient string when no stops', () => {
		expect(
			buildGradientCss({ fillMode: 'gradient', fillGradient: 'linear-gradient(red, blue)' }),
		).toBe('linear-gradient(red, blue)');
	});

	it('builds a linear gradient from structured stops + angle', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientType: 'linear',
			fillGradientAngle: 135,
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(css).toBe('linear-gradient(135deg, #ff0000 0%, #0000ff 100%)');
	});

	it('defaults the linear angle to 90deg', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(css).toContain('linear-gradient(90deg');
	});

	it('builds a radial circle gradient by default', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientStops: [
				{ color: '#ffffff', position: 0 },
				{ color: '#000000', position: 100 },
			],
		});
		expect(css).toBe('radial-gradient(circle at center center, #ffffff 0%, #000000 100%)');
	});

	it('builds a radial rect path gradient using fillToRect', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'rect',
			fillGradientFillToRect: { l: 0.25, t: 0.25, r: 0.25, b: 0.25 },
			fillGradientStops: [
				{ color: '#ffffff', position: 0 },
				{ color: '#000000', position: 100 },
			],
		});
		expect(css).toContain('radial-gradient(');
		expect(css).toContain('at 50% 50%');
	});

	it('builds a radial shape path gradient', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'shape',
			fillGradientStops: [
				{ color: '#ffffff', position: 0 },
				{ color: '#000000', position: 100 },
			],
		});
		expect(css).toContain('radial-gradient(farthest-side');
	});

	it('applies per-stop opacity', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#ff0000', position: 0, opacity: 0.5 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(css).toContain('rgba(255, 0, 0, 0.5) 0%');
	});
});

// ---------------------------------------------------------------------------
// getPatternSvg / buildPatternFill
// ---------------------------------------------------------------------------

describe('getPatternSvg', () => {
	it('renders an SVG for a known preset', () => {
		const svg = getPatternSvg('pct50', '#000000', '#ffffff');
		expect(svg).toContain('<svg');
		expect(svg).toContain('#000000');
		expect(svg).toContain('#ffffff');
	});
	it('returns null for an unknown preset', () => {
		expect(getPatternSvg('bogus', '#000000', '#ffffff')).toBeNull();
	});
});

describe('buildPatternFill', () => {
	it('returns undefined when not a pattern fill', () => {
		expect(buildPatternFill(undefined, 's1')).toBeUndefined();
		expect(buildPatternFill({ fillMode: 'solid' }, 's1')).toBeUndefined();
		expect(buildPatternFill({ fillMode: 'pattern' }, 's1')).toBeUndefined();
	});

	it('returns undefined for an unknown preset', () => {
		expect(
			buildPatternFill({ fillMode: 'pattern', fillPatternPreset: 'bogus' }, 's1'),
		).toBeUndefined();
	});

	it('builds a data-URI background + background colour', () => {
		const result = buildPatternFill(
			{
				fillMode: 'pattern',
				fillPatternPreset: 'cross',
				fillColor: '#112233',
				fillPatternBackgroundColor: '#ffffff',
			},
			's1',
		);
		expect(result).toBeDefined();
		expect(result?.backgroundImage).toContain('url("data:image/svg+xml,');
		expect(result?.backgroundColor).toBe('#ffffff');
		// foreground colour is URI-encoded inside the data URI
		expect(result?.backgroundImage).toContain(encodeURIComponent('#112233'));
	});

	it('defaults fg to black and bg to white', () => {
		const result = buildPatternFill({ fillMode: 'pattern', fillPatternPreset: 'pct50' }, 's1');
		expect(result?.backgroundColor).toBe('#ffffff');
		expect(result?.backgroundImage).toContain(encodeURIComponent('#000000'));
	});
});

// ---------------------------------------------------------------------------
// getComputedFillStyle (aggregate ordering)
// ---------------------------------------------------------------------------

describe('getComputedFillStyle', () => {
	it('returns undefined for elements without shape properties', () => {
		expect(
			getComputedFillStyle({
				type: 'media',
				id: 'm',
				x: 0,
				y: 0,
				width: 1,
				height: 1,
			} as PptxElement),
		).toBeUndefined();
	});

	it('returns an empty object when there is no shape style', () => {
		expect(getComputedFillStyle(shape(undefined))).toStrictEqual({});
	});

	it('prioritises image fill over everything', () => {
		const result = getComputedFillStyle(
			shape({
				fillMode: 'image',
				fillImageUrl: 'data:image/png;base64,xxx',
				fillImageMode: 'tile',
				fillColor: '#ff0000',
				fillGradient: 'linear-gradient(red, blue)',
			}),
		);
		expect(result?.backgroundColor).toBe('transparent');
		expect(result?.backgroundImage).toBe('url(data:image/png;base64,xxx)');
		expect(result?.backgroundRepeat).toBe('repeat');
		expect(result?.backgroundSize).toBe('auto');
	});

	it('uses stretch sizing for non-tiled image fills', () => {
		const result = getComputedFillStyle(shape({ fillMode: 'image', fillImageUrl: 'u' }));
		expect(result?.backgroundRepeat).toBe('no-repeat');
		expect(result?.backgroundSize).toBe('100% 100%');
	});

	it('resolves a structured gradient before pattern/solid', () => {
		const result = getComputedFillStyle(
			shape({
				fillMode: 'gradient',
				fillGradientAngle: 90,
				fillColor: '#ff0000',
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			}),
		);
		expect(result?.backgroundImage).toBe('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
		expect(result?.backgroundColor).toBeUndefined();
	});

	it('falls back to the prebuilt fillGradient string', () => {
		const result = getComputedFillStyle(
			shape({ fillMode: 'gradient', fillGradient: 'linear-gradient(red, blue)' }),
		);
		expect(result?.backgroundImage).toBe('linear-gradient(red, blue)');
	});

	it('resolves a pattern fill before solid', () => {
		const result = getComputedFillStyle(
			shape({
				fillMode: 'pattern',
				fillPatternPreset: 'cross',
				fillColor: '#000000',
				fillPatternBackgroundColor: '#eeeeee',
			}),
		);
		expect(result?.backgroundImage).toContain('data:image/svg+xml,');
		expect(result?.backgroundColor).toBe('#eeeeee');
		expect(result?.backgroundRepeat).toBe('repeat');
	});

	it('resolves a solid fill last', () => {
		const result = getComputedFillStyle(shape({ fillColor: '#abcdef' }));
		expect(result?.backgroundColor).toBe('#abcdef');
		expect(result?.backgroundImage).toBeUndefined();
	});

	it('applies fillOpacity to solid fills', () => {
		const result = getComputedFillStyle(shape({ fillColor: '#ff0000', fillOpacity: 0.5 }));
		expect(result?.backgroundColor).toBe('rgba(255, 0, 0, 0.5)');
	});

	it('emits nothing for fillMode none', () => {
		const result = getComputedFillStyle(shape({ fillMode: 'none', fillColor: '#ff0000' }));
		expect(result).toStrictEqual({});
	});
});
