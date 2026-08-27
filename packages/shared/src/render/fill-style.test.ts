import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildGradientCss,
	buildPatternFill,
	buildReflectedGradientStops,
	getComputedFillStyle,
	getGradientTileFlipCss,
	getGradientTileRectCss,
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
	// OOXML measures clockwise from +x, CSS clockwise from "to top": a quarter
	// turn apart. `ang="0"` (left to right) is CSS `90deg`.

	it('rotates the OOXML angle a quarter turn into CSS space', () => {
		expect(convertOoxmlAngleToCss(0)).toBe(90);
		expect(convertOoxmlAngleToCss(90)).toBe(180);
		expect(convertOoxmlAngleToCss(180)).toBe(270);
		expect(convertOoxmlAngleToCss(270)).toBe(0);
	});

	it('normalizes degrees into 0-360', () => {
		expect(convertOoxmlAngleToCss(370)).toBe(100);
		expect(convertOoxmlAngleToCss(-10)).toBe(80);
	});

	it('converts 60000ths when alreadyDegrees is false', () => {
		expect(convertOoxmlAngleToCss(60000 * 90, false)).toBe(180);
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
		expect(css).toBe('linear-gradient(225deg, #ff0000 0%, #0000ff 100%)');
	});

	it('defaults the OOXML angle to 90 (CSS 180deg, top to bottom)', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(css).toContain('linear-gradient(180deg');
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

	it('builds a rect path gradient as a nested-rectangle SVG image, using fillToRect for centring', () => {
		// A rect path gradient is rendered as an SVG data URI, not a CSS
		// `radial-gradient()`: PowerPoint's own rect path gradient has square
		// corners, which no native CSS/SVG radial gradient can express (see
		// `path-gradient-rect.ts`).
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
		expect(css).toMatch(/^url\("data:image\/svg\+xml,/u);
		const decoded = decodeURIComponent(css!.slice('url("data:image/svg+xml,'.length, -2));
		expect(decoded).toContain('<rect');
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
// Gradient tile/flip mode
// ---------------------------------------------------------------------------

describe('getGradientTileFlipCss', () => {
	it('returns undefined for "none" / undefined', () => {
		expect(getGradientTileFlipCss('none')).toBeUndefined();
		expect(getGradientTileFlipCss(undefined)).toBeUndefined();
	});

	it('returns horizontal repeat for "x"', () => {
		expect(getGradientTileFlipCss('x')).toStrictEqual({
			backgroundSize: '50% 100%',
			backgroundRepeat: 'repeat-x',
		});
	});

	it('returns vertical repeat for "y"', () => {
		expect(getGradientTileFlipCss('y')).toStrictEqual({
			backgroundSize: '100% 50%',
			backgroundRepeat: 'repeat-y',
		});
	});

	it('returns full repeat for "xy"', () => {
		expect(getGradientTileFlipCss('xy')).toStrictEqual({
			backgroundSize: '50% 50%',
			backgroundRepeat: 'repeat',
		});
	});
});

describe('buildReflectedGradientStops', () => {
	it('returns [] for empty input', () => {
		expect(buildReflectedGradientStops([])).toStrictEqual([]);
	});

	it('produces forward (0-50) + mirrored (50-100) stops', () => {
		const reflected = buildReflectedGradientStops([
			{ color: '#ff0000', position: 0 },
			{ color: '#0000ff', position: 100 },
		]);
		expect(reflected).toHaveLength(4);
		expect(reflected[0]).toMatchObject({ color: '#ff0000', position: 0 });
		expect(reflected[1]).toMatchObject({ color: '#0000ff', position: 50 });
		expect(reflected[2]).toMatchObject({ color: '#0000ff', position: 50 });
		expect(reflected[3]).toMatchObject({ color: '#ff0000', position: 100 });
	});

	it('preserves opacity on reflected stops', () => {
		const reflected = buildReflectedGradientStops([
			{ color: '#ff0000', position: 0, opacity: 0.5 },
			{ color: '#0000ff', position: 100, opacity: 1 },
		]);
		expect(reflected[0].opacity).toBe(0.5);
		expect(reflected[3].opacity).toBe(0.5);
		expect(reflected[1].opacity).toBe(1);
		expect(reflected[2].opacity).toBe(1);
	});
});

describe('buildGradientCss tile-flip', () => {
	const stops: ShapeStyle['fillGradientStops'] = [
		{ color: '#ff0000', position: 0 },
		{ color: '#0000ff', position: 100 },
	];

	it('leaves a non-flip gradient byte-for-byte unchanged', () => {
		const base = buildGradientCss({
			fillMode: 'gradient',
			fillGradientAngle: 90,
			fillGradientStops: stops,
		});
		const explicitNone = buildGradientCss({
			fillMode: 'gradient',
			fillGradientAngle: 90,
			fillGradientFlip: 'none',
			fillGradientStops: stops,
		});
		expect(base).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
		expect(explicitNone).toBe(base);
	});

	it('reflects the stops for flip "x"', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientAngle: 90,
			fillGradientFlip: 'x',
			fillGradientStops: stops,
		});
		expect(css).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 50%, #0000ff 50%, #ff0000 100%)');
	});

	it('reflects the stops for flip "y"', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientAngle: 90,
			fillGradientFlip: 'y',
			fillGradientStops: stops,
		});
		expect(css).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 50%, #0000ff 50%, #ff0000 100%)');
	});

	it('reflects the stops for flip "xy"', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientAngle: 90,
			fillGradientFlip: 'xy',
			fillGradientStops: stops,
		});
		expect(css).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 50%, #0000ff 50%, #ff0000 100%)');
	});

	it('does not reflect radial gradients even when flip is set', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientFlip: 'xy',
			fillGradientStops: stops,
		});
		expect(css).toBe('radial-gradient(circle at center center, #ff0000 0%, #0000ff 100%)');
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
		expect(result?.backgroundImage).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
		expect(result?.backgroundColor).toBeUndefined();
	});

	it('falls back to the prebuilt fillGradient string', () => {
		const result = getComputedFillStyle(
			shape({ fillMode: 'gradient', fillGradient: 'linear-gradient(red, blue)' }),
		);
		expect(result?.backgroundImage).toBe('linear-gradient(red, blue)');
	});

	it('emits no tile props for a non-flip structured gradient', () => {
		const result = getComputedFillStyle(
			shape({
				fillMode: 'gradient',
				fillGradientAngle: 90,
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			}),
		);
		expect(result?.backgroundSize).toBeUndefined();
		expect(result?.backgroundRepeat).toBeUndefined();
	});

	it('emits reflected gradient + tile CSS for flip "x"', () => {
		const result = getComputedFillStyle(
			shape({
				fillMode: 'gradient',
				fillGradientAngle: 90,
				fillGradientFlip: 'x',
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			}),
		);
		expect(result?.backgroundImage).toBe(
			'linear-gradient(180deg, #ff0000 0%, #0000ff 50%, #0000ff 50%, #ff0000 100%)',
		);
		expect(result?.backgroundSize).toBe('50% 100%');
		expect(result?.backgroundRepeat).toBe('repeat-x');
	});

	it('emits tile CSS for flip "y" and "xy"', () => {
		const yResult = getComputedFillStyle(
			shape({
				fillMode: 'gradient',
				fillGradientFlip: 'y',
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			}),
		);
		expect(yResult?.backgroundSize).toBe('100% 50%');
		expect(yResult?.backgroundRepeat).toBe('repeat-y');

		const xyResult = getComputedFillStyle(
			shape({
				fillMode: 'gradient',
				fillGradientFlip: 'xy',
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			}),
		);
		expect(xyResult?.backgroundSize).toBe('50% 50%');
		expect(xyResult?.backgroundRepeat).toBe('repeat');
	});

	it('does not emit tile CSS for a radial gradient with flip set', () => {
		const result = getComputedFillStyle(
			shape({
				fillMode: 'gradient',
				fillGradientType: 'radial',
				fillGradientFlip: 'xy',
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			}),
		);
		expect(result?.backgroundImage).toContain('radial-gradient(');
		expect(result?.backgroundSize).toBeUndefined();
		expect(result?.backgroundRepeat).toBeUndefined();
	});

	it('stretches a rect path gradient image to the full box, unlike a CSS gradient', () => {
		// The rect-path SVG data URI is a real IMAGE, not a CSS <gradient>
		// function: without an explicit size/repeat it would tile at its
		// intrinsic size instead of covering the shape.
		const result = getComputedFillStyle(
			shape({
				fillMode: 'gradient',
				fillGradientType: 'radial',
				fillGradientPathType: 'rect',
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			}),
		);
		expect(result?.backgroundImage).toMatch(/^url\("data:image\/svg\+xml,/u);
		expect(result?.backgroundSize).toBe('100% 100%');
		expect(result?.backgroundRepeat).toBe('no-repeat');
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

// ---------------------------------------------------------------------------
// buildGradientCss — @rotWithShape / @scaled corrections (#97)
// ---------------------------------------------------------------------------

describe('buildGradientCss angle corrections', () => {
	it('leaves the angle unchanged when no geometry context is supplied', () => {
		const css = buildGradientCss({
			fillMode: 'gradient',
			fillGradientAngle: 90,
			fillGradientRotWithShape: false,
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(css).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
	});

	it('counter-rotates by the element rotation when rotWithShape is false', () => {
		const css = buildGradientCss(
			{
				fillMode: 'gradient',
				fillGradientAngle: 90,
				fillGradientRotWithShape: false,
				fillGradientScaled: false,
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			},
			{ rotation: 45, width: 100, height: 100 },
		);
		expect(css).toBe('linear-gradient(135deg, #ff0000 0%, #0000ff 100%)');
	});

	it('does not counter-rotate when rotWithShape is the default (true)', () => {
		const css = buildGradientCss(
			{
				fillMode: 'gradient',
				fillGradientAngle: 90,
				fillGradientScaled: false,
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			},
			{ rotation: 45, width: 100, height: 100 },
		);
		expect(css).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
	});

	it('applies aspect-ratio scaling to the angle when scaled is not false', () => {
		const css = buildGradientCss(
			{
				fillMode: 'gradient',
				fillGradientAngle: 45,
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			},
			{ width: 200, height: 100 },
		);
		// atan2(100*sin45, 200*cos45) = atan(0.5) ~= 26.57 OOXML deg,
		// +90 into CSS space and rounded -> 117deg
		expect(css).toBe('linear-gradient(117deg, #ff0000 0%, #0000ff 100%)');
	});

	it('skips aspect scaling when scaled is explicitly false', () => {
		const css = buildGradientCss(
			{
				fillMode: 'gradient',
				fillGradientAngle: 45,
				fillGradientScaled: false,
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			},
			{ width: 200, height: 100 },
		);
		expect(css).toBe('linear-gradient(135deg, #ff0000 0%, #0000ff 100%)');
	});

	it('skips aspect scaling for a square shape', () => {
		const css = buildGradientCss(
			{
				fillMode: 'gradient',
				fillGradientAngle: 45,
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			},
			{ width: 100, height: 100 },
		);
		expect(css).toBe('linear-gradient(135deg, #ff0000 0%, #0000ff 100%)');
	});
});

// ---------------------------------------------------------------------------
// getGradientTileRectCss (#97)
// ---------------------------------------------------------------------------

describe('getGradientTileRectCss', () => {
	it('returns undefined for a missing rect', () => {
		expect(getGradientTileRectCss(undefined)).toBeUndefined();
	});

	it('returns undefined for a full-bleed rect (no meaningful inset)', () => {
		expect(getGradientTileRectCss({ l: 0, t: 0, r: 0, b: 0 })).toBeUndefined();
	});

	it('confines the gradient to the tile rectangle', () => {
		expect(getGradientTileRectCss({ l: 0.25, t: 0, r: 0.25, b: 0 })).toStrictEqual({
			backgroundSize: '50% 100%',
			backgroundPosition: '50% 0%',
			backgroundRepeat: 'no-repeat',
		});
	});

	// issue #132: PowerPoint's stock "radial gradient from a corner" writes
	// `<a:tileRect l="-100000" t="-100000"/>`, i.e. a tile TWICE the shape hung
	// off its top-left. The position guard tested `1 - size > 0.001`, which is
	// false for every oversized tile, so the offset was dropped and the focal
	// point snapped back onto the shape's own corner.
	it('offsets a tile larger than the shape (negative insets)', () => {
		expect(getGradientTileRectCss({ l: -1, t: -1, r: 0, b: 0 })).toStrictEqual({
			backgroundSize: '200% 200%',
			backgroundPosition: '100% 100%',
			backgroundRepeat: 'no-repeat',
		});
	});

	it('offsets an oversized tile hung off the bottom-right', () => {
		expect(getGradientTileRectCss({ l: 0, t: 0, r: -1, b: -1 })).toStrictEqual({
			backgroundSize: '200% 200%',
			backgroundPosition: '0% 0%',
			backgroundRepeat: 'no-repeat',
		});
	});
});

describe('getComputedFillStyle tileRect', () => {
	it('applies tileRect sizing/position to a structured gradient', () => {
		const result = getComputedFillStyle(
			shape({
				fillMode: 'gradient',
				fillGradientAngle: 90,
				fillGradientTileRect: { l: 0.25, t: 0.25, r: 0.25, b: 0.25 },
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 100 },
				],
			}),
		);
		expect(result?.backgroundImage).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
		expect(result?.backgroundSize).toBe('50% 50%');
		expect(result?.backgroundPosition).toBe('50% 50%');
		expect(result?.backgroundRepeat).toBe('no-repeat');
	});
});

// ---------------------------------------------------------------------------
// getComputedFillStyle — grpFill inheritance (#97c)
// ---------------------------------------------------------------------------

describe('getComputedFillStyle grpFill inheritance', () => {
	it('inherits the parent group fill for a fillMode "group" child', () => {
		const result = getComputedFillStyle(shape({ fillMode: 'group' }), { fillColor: '#abcdef' });
		expect(result?.backgroundColor).toBe('#abcdef');
	});

	it('inherits a parent group gradient fill', () => {
		const result = getComputedFillStyle(shape({ fillMode: 'group' }), {
			fillMode: 'gradient',
			fillGradientAngle: 90,
			fillGradientStops: [
				{ color: '#ff0000', position: 0 },
				{ color: '#0000ff', position: 100 },
			],
		});
		expect(result?.backgroundImage).toBe('linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
	});

	it('emits nothing for a group child with no parent fill supplied', () => {
		expect(getComputedFillStyle(shape({ fillMode: 'group' }))).toStrictEqual({});
	});
});

// ---------------------------------------------------------------------------
// Circle path gradients must emit PARSEABLE CSS (#132)
// ---------------------------------------------------------------------------

describe('buildGradientCss circle path gradients', () => {
	const circleStyle = (fillToRect?: { l: number; t: number; r: number; b: number }): ShapeStyle =>
		({
			fillMode: 'gradient',
			fillGradientType: 'radial',
			fillGradientPathType: 'circle',
			fillGradientFillToRect: fillToRect,
			fillGradientStops: [
				{ color: '#BFBFBF', position: 0 },
				{ color: '#FFFFFF', position: 100 },
			],
		}) as ShapeStyle;

	// CSS only accepts a LENGTH as a circle's radius. `radial-gradient(circle
	// 100% at 0% 0%, …)` parses as invalid, so the browser discards the whole
	// declaration and the shape renders with NO fill - which is how PowerPoint's
	// stock corner-radial preset vanished entirely (issue #132).
	it('never sizes a circle with a percentage radius', () => {
		for (const rect of [
			{ l: 0, t: 0, r: 1, b: 1 },
			{ l: 0.5, t: 0.5, r: 0.5, b: 0.5 },
			{ l: 0.25, t: 0, r: 0, b: 0.75 },
		]) {
			expect(buildGradientCss(circleStyle(rect))).not.toMatch(/circle\s+[\d.]+%/u);
		}
	});

	it('sizes the explicit form as matching ellipse semi-axes', () => {
		// fillToRect r=b=100000 collapses to the top-left corner: centre 0% 0%,
		// radius max(0, 100, 0, 100) = 100.
		expect(buildGradientCss(circleStyle({ l: 0, t: 0, r: 1, b: 1 }))).toBe(
			'radial-gradient(ellipse 100% 100% at 0% 0%, #BFBFBF 0%, #FFFFFF 100%)',
		);
	});

	it('keeps the keyword-sized form, which is valid for a circle', () => {
		expect(buildGradientCss(circleStyle())).toBe(
			'radial-gradient(circle at center center, #BFBFBF 0%, #FFFFFF 100%)',
		);
	});
});
