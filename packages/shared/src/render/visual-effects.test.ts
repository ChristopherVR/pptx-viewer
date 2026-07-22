import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildReflectionCssValue,
	getBoxShadowCss,
	getComputedEffectStyle,
	getDuotoneSvgFilter,
	getEffectDagBlendMode,
	getEffectDagCssFilter,
	getEffectDagFillOverlay,
	getEffectDagOpacity,
	getEffectFilterCss,
	getGlowBoxShadowCss,
	getInnerShadowCss,
	getMultiLayerShadowCss,
	getOuterShadowCss,
	getReflectionCss,
	getSoftEdgeSvgFilter,
} from './visual-effects';

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

// (normalizeHexColor / colorWithOpacity are exported by `fill-style` — the
//  canonical copy — and covered by its test.)

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

	it('soft edge without an element id falls back to a minimised blur', () => {
		// A full-element blur would wash out interior fill/text, so with no
		// injectable SVG-filter target the blur is capped low.
		expect(getEffectFilterCss({ softEdgeRadius: 5 })).toBe('blur(2px)');
	});

	it('soft edge references the alpha-feather SVG filter when an element id is given', () => {
		expect(getEffectFilterCss({ softEdgeRadius: 5 }, 'el-9')).toBe('url(#soft-edge-el-9)');
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
		// Soft edge now feathers via an SVG filter reference (element id 's1'),
		// not a whole-element blur.
		expect(result.filter).toContain('url(#soft-edge-s1)');
		expect(result.webkitBoxReflect).toContain('below 4px');
		expect(result.opacity).toBe(0.8);
		expect(result.mixBlendMode).toBe('multiply');
	});

	it('emits a fillOverlay tint layer (not a whole-element blend) when a colour is parsed', () => {
		const result = getComputedEffectStyle(
			shape({
				dagFillOverlayColor: '#ff0000',
				dagFillOverlayOpacity: 0.5,
				dagFillOverlayBlend: 'mult',
			}),
		);
		expect(result.fillOverlay).toStrictEqual({
			color: 'rgba(255, 0, 0, 0.5)',
			blendMode: 'multiply',
		});
		// The blend rides on the overlay layer, not the whole element.
		expect(result.mixBlendMode).toBeUndefined();
	});

	it('sets overflowVisible when a blur effect has @grow', () => {
		expect(
			getComputedEffectStyle(shape({ blurRadius: 6, blurGrow: true })).overflowVisible,
		).toBeTruthy();
		expect(getComputedEffectStyle(shape({ blurRadius: 6 })).overflowVisible).toBeUndefined();
	});
});

// ── fill overlay tint (item 1) ──────────────────────────────────────────────

describe('getEffectDagFillOverlay', () => {
	it('returns undefined without an overlay colour', () => {
		expect(getEffectDagFillOverlay(undefined)).toBeUndefined();
		expect(getEffectDagFillOverlay({})).toBeUndefined();
		expect(getEffectDagFillOverlay({ dagFillOverlayColor: 'transparent' })).toBeUndefined();
	});

	it("maps the 'over' blend to a normal (opaque) tint", () => {
		expect(
			getEffectDagFillOverlay({ dagFillOverlayColor: '#00ff00', dagFillOverlayBlend: 'over' }),
		).toStrictEqual({ color: '#00ff00', blendMode: 'normal' });
	});

	it('carries opacity into an rgba() overlay colour and maps the blend mode', () => {
		expect(
			getEffectDagFillOverlay({
				dagFillOverlayColor: '#123456',
				dagFillOverlayOpacity: 0.25,
				dagFillOverlayBlend: 'screen',
			}),
		).toStrictEqual({ color: 'rgba(18, 52, 86, 0.25)', blendMode: 'screen' });
	});
});

// ── soft-edge SVG feather filter (item 2) ───────────────────────────────────

describe('getSoftEdgeSvgFilter', () => {
	it('returns undefined without a positive soft-edge radius', () => {
		expect(getSoftEdgeSvgFilter({}, 'el-1')).toBeUndefined();
		expect(getSoftEdgeSvgFilter({ softEdgeRadius: 0 }, 'el-1')).toBeUndefined();
	});

	it('feathers only the alpha edge (SourceAlpha blur composited into SourceGraphic)', () => {
		const def = getSoftEdgeSvgFilter({ softEdgeRadius: 5 }, 'el-1');
		expect(def?.id).toBe('soft-edge-el-1');
		expect(def?.cssReference).toBe('url(#soft-edge-el-1)');
		expect(def?.filterMarkup).toContain('<filter id="soft-edge-el-1"');
		expect(def?.filterMarkup).toContain('feGaussianBlur in="SourceAlpha" stdDeviation="5"');
		expect(def?.filterMarkup).toContain(
			'feComposite in="SourceGraphic" in2="softEdgeAlpha" operator="in"',
		);
	});
});

// ── outer-shadow scale spread (item 3) ──────────────────────────────────────

describe('getOuterShadowCss scale (@sx/@sy)', () => {
	it('adds a positive spread when the shadow is scaled above 100%', () => {
		// sx/sy 150% → spread = round(max(blur,4) * 0.5) = round(8 * 0.5) = 4
		const css = getOuterShadowCss({
			shadowColor: '#000000',
			shadowOffsetX: 4,
			shadowOffsetY: 4,
			shadowBlur: 8,
			shadowOpacity: 0.35,
			shadowScaleX: 150000,
			shadowScaleY: 150000,
		});
		expect(css).toBe('4px 4px 8px 4px rgba(0, 0, 0, 0.35)');
	});

	it('omits the spread term at 100% scale (classic 3-length output)', () => {
		const css = getOuterShadowCss({
			shadowColor: '#000000',
			shadowOffsetX: 4,
			shadowOffsetY: 4,
			shadowBlur: 8,
			shadowOpacity: 0.35,
			shadowScaleX: 100000,
			shadowScaleY: 100000,
		});
		expect(css).toBe('4px 4px 8px rgba(0, 0, 0, 0.35)');
	});
});

// ── reflection start position (item 4) ──────────────────────────────────────

describe('reflection @stPos', () => {
	it('inserts a hold stop so the reflection stays opaque until the start position', () => {
		// stPos 0.5 of a 100px fade → hold at 50px.
		const r = getReflectionCss(
			{ reflectionStartOpacity: 1, reflectionEndPosition: 0.5, reflectionStartPosition: 0.5 },
			200,
		);
		expect(r?.webkitBoxReflect).toContain('rgba(255,255,255,1) 50px,');
	});

	it('buildReflectionCssValue leaves output unchanged when startOffset is 0', () => {
		expect(buildReflectionCssValue(4, 0.5, 0, 100, 0, 0)).toBe(
			'below 4px linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0) 100px)',
		);
	});
});
