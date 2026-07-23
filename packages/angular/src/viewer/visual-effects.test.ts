import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildReflectionCssValue,
	colorWithOpacity,
	getBoxShadowCss,
	getComputedEffectStyle,
	getDuotoneSvgFilter,
	getEffectDagBlendMode,
	getEffectDagCssFilter,
	getEffectDagOpacity,
	getEffectFilterCss,
	getGlowBoxShadowCss,
	getInnerShadowCss,
	getMultiLayerShadowCss,
	getOuterShadowCss,
	getReflectionCss,
	normalizeHexColor,
} from '../internal/shared';

function shape(shapeStyle?: ShapeStyle, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 200,
		shapeStyle,
		...overrides,
	} as PptxElement;
}

// ── colour helpers ─────────────────────────────────────────────────────────

describe('colour helpers', () => {
	it('normalizeHexColor falls back for invalid/transparent', () => {
		expect(normalizeHexColor('#abcdef', '#000000')).toBe('#abcdef');
		expect(normalizeHexColor('abcdef', '#000000')).toBe('#abcdef');
		expect(normalizeHexColor('transparent', '#123456')).toBe('#123456');
		expect(normalizeHexColor(undefined, '#123456')).toBe('#123456');
		expect(normalizeHexColor('not-a-color', '#123456')).toBe('#123456');
	});

	it('colorWithOpacity produces rgba()', () => {
		expect(colorWithOpacity('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
		expect(colorWithOpacity('#ff0000', undefined)).toBe('#ff0000');
		expect(colorWithOpacity('#ff0000', 2)).toBe('rgba(255, 0, 0, 1)');
		expect(colorWithOpacity('#ff0000', -1)).toBe('rgba(255, 0, 0, 0)');
	});
});

// ── outer shadow ────────────────────────────────────────────────────────────

describe('getOuterShadowCss', () => {
	it('returns undefined without a shadow colour', () => {
		expect(getOuterShadowCss(undefined)).toBeUndefined();
		expect(getOuterShadowCss({})).toBeUndefined();
		expect(getOuterShadowCss({ shadowColor: 'transparent' })).toBeUndefined();
	});

	it('uses direct x/y offsets, blur and opacity', () => {
		const css = getOuterShadowCss({
			shadowColor: '#000000',
			shadowOffsetX: 4,
			shadowOffsetY: 6,
			shadowBlur: 8,
			shadowOpacity: 0.3,
		});
		expect(css).toBe('4px 6px 8px rgba(0, 0, 0, 0.3)');
	});

	it('derives offsets from angle + distance', () => {
		// angle 0deg, distance 10 → offsetX 10, offsetY 0
		const css = getOuterShadowCss({
			shadowColor: '#000000',
			shadowAngle: 0,
			shadowDistance: 10,
			shadowBlur: 0,
			shadowOpacity: 1,
		});
		expect(css).toBe('10px 0px 0px rgba(0, 0, 0, 1)');
	});

	it('applies defaults for missing blur/opacity/offsets', () => {
		const css = getOuterShadowCss({ shadowColor: '#112233' });
		// default offsets 4,4 / blur 6 / opacity 0.35
		expect(css).toBe('4px 4px 6px rgba(17, 34, 51, 0.35)');
	});
});

// ── inner shadow ────────────────────────────────────────────────────────────

describe('getInnerShadowCss', () => {
	it('returns undefined without an inner-shadow colour', () => {
		expect(getInnerShadowCss({})).toBeUndefined();
	});

	it('builds an inset box-shadow', () => {
		const css = getInnerShadowCss({
			innerShadowColor: '#000000',
			innerShadowOffsetX: 2,
			innerShadowOffsetY: 3,
			innerShadowBlur: 5,
			innerShadowOpacity: 0.5,
		});
		expect(css).toBe('inset 2px 3px 5px rgba(0, 0, 0, 0.5)');
	});
});

// ── multi-layer shadow ──────────────────────────────────────────────────────

describe('getMultiLayerShadowCss', () => {
	it('returns undefined for empty/missing shadows', () => {
		expect(getMultiLayerShadowCss({})).toBeUndefined();
		expect(getMultiLayerShadowCss({ shadows: [] })).toBeUndefined();
	});

	it('joins layers with commas and skips transparent', () => {
		const css = getMultiLayerShadowCss({
			shadows: [
				{ color: '#000000', opacity: 0.5, blur: 4, angle: 0, distance: 10 },
				{ color: 'transparent', opacity: 1, blur: 2, angle: 0, distance: 5 },
			],
		});
		expect(css).toBe('10px 0px 4px rgba(0, 0, 0, 0.5)');
	});
});

// ── glow box-shadow ─────────────────────────────────────────────────────────

describe('getGlowBoxShadowCss', () => {
	it('returns undefined without a glow', () => {
		expect(getGlowBoxShadowCss(undefined, 10, 0.5)).toBeUndefined();
		expect(getGlowBoxShadowCss('#ff0', 0, 0.5)).toBeUndefined();
	});

	it('produces three layered shadows', () => {
		const css = getGlowBoxShadowCss('#ffff00', 9, 1);
		// r1 = 3, r2 = 6, r3 = 9
		expect(css).toContain('0 0 3px rgba(255, 255, 0, 1)');
		expect(css).toContain('0 0 6px rgba(255, 255, 0, 0.6)');
		expect(css).toContain('0 0 9px');
	});
});

// ── combined box-shadow ─────────────────────────────────────────────────────

describe('getBoxShadowCss', () => {
	it('returns undefined when nothing applies', () => {
		expect(getBoxShadowCss({})).toBeUndefined();
		expect(getBoxShadowCss(undefined)).toBeUndefined();
	});

	it('outer shadow appears with expected offset/blur/colour', () => {
		const css = getBoxShadowCss({
			shadowColor: '#000000',
			shadowOffsetX: 4,
			shadowOffsetY: 4,
			shadowBlur: 6,
			shadowOpacity: 0.35,
		});
		expect(css).toBe('4px 4px 6px rgba(0, 0, 0, 0.35)');
	});

	it('multi-layer shadow takes precedence over single outer shadow', () => {
		const css = getBoxShadowCss({
			shadowColor: '#000000',
			shadowOffsetX: 4,
			shadowOffsetY: 4,
			shadows: [{ color: '#ff0000', opacity: 1, blur: 2, angle: 0, distance: 8 }],
		});
		expect(css).toContain('8px 0px 2px rgba(255, 0, 0, 1)');
		expect(css).not.toContain('4px 4px');
	});

	it('combines outer + inner + glow', () => {
		const css = getBoxShadowCss({
			shadowColor: '#000000',
			innerShadowColor: '#111111',
			glowColor: '#00ff00',
			glowRadius: 9,
			glowOpacity: 1,
		});
		expect(css).toContain('rgba(0, 0, 0,'); // outer
		expect(css).toContain('inset'); // inner
		expect(css).toContain('rgba(0, 255, 0,'); // glow
	});

	it('can exclude the glow layer', () => {
		const css = getBoxShadowCss(
			{ shadowColor: '#000000', glowColor: '#00ff00', glowRadius: 9 },
			{ includeGlow: false },
		);
		expect(css).not.toContain('0, 255, 0');
	});
});

// ── effect filter (glow / soft-edge / blur / dag) ───────────────────────────

describe('getEffectFilterCss', () => {
	it('returns undefined with no effects', () => {
		expect(getEffectFilterCss({})).toBeUndefined();
		expect(getEffectFilterCss(undefined)).toBeUndefined();
	});

	it('glow produces a drop-shadow filter', () => {
		const css = getEffectFilterCss({ glowColor: '#ffff00', glowRadius: 12, glowOpacity: 0.75 });
		expect(css).toBeDefined();
		expect(css).toContain('drop-shadow(0 0 12px rgba(255, 255, 0, 0.75))');
	});

	it('soft edge without an element id falls back to a capped blur filter', () => {
		// With no element id there is no <filter> to reference, so soft edge
		// falls back to a blur capped at 2px (the SVG alpha-feather filter, which
		// blurs only the edge rather than the whole element, needs an id).
		expect(getEffectFilterCss({ softEdgeRadius: 5 })).toBe('blur(2px)');
	});

	it('standalone blur produces a blur filter', () => {
		expect(getEffectFilterCss({ blurRadius: 3 })).toBe('blur(3px)');
	});

	it('includes DAG filters and duotone reference with element id', () => {
		const css = getEffectFilterCss(
			{ dagGrayscale: true, dagDuotone: { color1: '#000000', color2: '#ffffff' } },
			'el-7',
		);
		expect(css).toContain('grayscale(1)');
		expect(css).toContain('url(#dag-duotone-el-7)');
	});
});

// ── effect-dag css filter ───────────────────────────────────────────────────

describe('getEffectDagCssFilter', () => {
	it('returns undefined with no DAG props', () => {
		expect(getEffectDagCssFilter({})).toBeUndefined();
	});

	it('maps bi-level threshold', () => {
		expect(getEffectDagCssFilter({ dagBiLevel: 70 })).toBe('contrast(1000)');
		expect(getEffectDagCssFilter({ dagBiLevel: 30 })).toBe('contrast(0.01)');
	});

	it('maps lum brightness/contrast and hsl', () => {
		const css = getEffectDagCssFilter({
			dagLumBrightness: 50,
			dagLumContrast: -20,
			dagHslHue: 90,
			dagHslSaturation: 50,
		});
		expect(css).toContain('brightness(1.5)');
		expect(css).toContain('contrast(0.8)');
		expect(css).toContain('hue-rotate(90deg)');
		expect(css).toContain('saturate(0.5)');
	});
});

// ── dag opacity & blend ─────────────────────────────────────────────────────

describe('dag opacity and blend mode', () => {
	it('extracts opacity from dagAlphaModFix', () => {
		expect(getEffectDagOpacity({ dagAlphaModFix: 50 })).toBe(0.5);
		expect(getEffectDagOpacity({ dagAlphaModFix: 150 })).toBe(1);
		expect(getEffectDagOpacity({})).toBeUndefined();
	});

	it('maps blend mode', () => {
		expect(getEffectDagBlendMode('mult')).toBe('multiply');
		expect(getEffectDagBlendMode('screen')).toBe('screen');
		expect(getEffectDagBlendMode('over')).toBeUndefined();
		expect(getEffectDagBlendMode(undefined)).toBeUndefined();
	});
});

// ── reflection ──────────────────────────────────────────────────────────────

describe('getReflectionCss', () => {
	it('returns undefined when no reflection is set', () => {
		expect(getReflectionCss({}, 200)).toBeUndefined();
	});

	it('builds a -webkit-box-reflect value (no blur)', () => {
		const r = getReflectionCss({ reflectionStartOpacity: 0.5, reflectionDistance: 4 }, 200);
		expect(r).toBeDefined();
		expect(r?.webkitBoxReflect).toContain('below 4px linear-gradient(to bottom,');
		expect(r?.webkitBoxReflect).toContain('rgba(255,255,255,0.5)');
	});

	it('derives fade length from reflectionEndPosition × height', () => {
		const r = getReflectionCss({ reflectionStartOpacity: 1, reflectionEndPosition: 0.5 }, 200);
		// 0.5 * 200 = 100px fade length
		expect(r?.fadeLength).toBe(100);
		expect(r?.webkitBoxReflect).toContain('100px)');
	});

	it('uses a three-stop gradient when blurred', () => {
		const r = getReflectionCss(
			{ reflectionStartOpacity: 1, reflectionBlurRadius: 4, reflectionEndPosition: 0.5 },
			200,
		);
		expect(r?.webkitBoxReflect.match(/rgba\(255,255,255,/gu)?.length).toBe(3);
	});

	it('buildReflectionCssValue matches the no-blur format', () => {
		expect(buildReflectionCssValue(4, 0.5, 0, 100)).toBe(
			'below 4px linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0) 100px)',
		);
	});
});

// ── duotone svg filter ──────────────────────────────────────────────────────

describe('getDuotoneSvgFilter', () => {
	it('returns undefined without dagDuotone', () => {
		expect(getDuotoneSvgFilter({}, 'el-1')).toBeUndefined();
	});

	it('builds filter markup, id and css reference', () => {
		const def = getDuotoneSvgFilter(
			{ dagDuotone: { color1: '#000000', color2: '#ffffff' } },
			'el-1',
		);
		expect(def?.id).toBe('dag-duotone-el-1');
		expect(def?.cssReference).toBe('url(#dag-duotone-el-1)');
		expect(def?.filterMarkup).toContain('<filter id="dag-duotone-el-1"');
		expect(def?.filterMarkup).toContain('feComponentTransfer');
		// black→white: slope 1, intercept 0
		expect(def?.filterMarkup).toContain('slope="1"');
	});
});

// ── aggregate ───────────────────────────────────────────────────────────────

describe('getComputedEffectStyle', () => {
	it('returns an empty object when the element has no effects', () => {
		expect(getComputedEffectStyle(shape())).toStrictEqual({});
		expect(getComputedEffectStyle(shape({}))).toStrictEqual({});
	});

	it('aggregates box-shadow, filter, reflection, opacity and blend', () => {
		const result = getComputedEffectStyle(
			shape({
				shadowColor: '#000000',
				glowColor: '#00ff00',
				glowRadius: 10,
				softEdgeRadius: 3,
				reflectionStartOpacity: 0.5,
				reflectionDistance: 4,
				dagAlphaModFix: 80,
				dagFillOverlayBlend: 'mult',
			}),
		);
		expect(result.boxShadow).toContain('rgba(0, 0, 0,');
		expect(result.filter).toContain('drop-shadow');
		// Soft edge now emits an SVG alpha-feather filter reference when an
		// element id is present, instead of a whole-element blur().
		expect(result.filter).toContain('url(#soft-edge-');
		expect(result.webkitBoxReflect).toContain('below 4px');
		expect(result.opacity).toBe(0.8);
		expect(result.mixBlendMode).toBe('multiply');
	});
});
