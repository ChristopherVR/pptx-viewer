import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import {
	getDuotoneFilterId,
	hasDuotoneEffect,
	getDuotoneColors,
	buildLineShadowCss,
	buildLineGlowFilter,
	mapDagBlendModeToCss,
	getDagDuotoneFilterId,
	hasDagDuotoneEffect,
	getImageAlphaFilterId,
	hasAdvancedImageAlphaEffects,
	renderImageAlphaSvgFilter,
} from './shape-visual-filters';

// ---------------------------------------------------------------------------
// getDuotoneFilterId
// ---------------------------------------------------------------------------

describe('getDuotoneFilterId', () => {
	it("generates a filter ID prefixed with 'duotone-'", () => {
		expect(getDuotoneFilterId('elem-1')).toBe('duotone-elem-1');
	});

	it('handles empty string', () => {
		expect(getDuotoneFilterId('')).toBe('duotone-');
	});

	it('preserves special characters in the element ID', () => {
		expect(getDuotoneFilterId('a-b_c.d')).toBe('duotone-a-b_c.d');
	});
});

// ---------------------------------------------------------------------------
// getDagDuotoneFilterId
// ---------------------------------------------------------------------------

describe('getDagDuotoneFilterId', () => {
	it("generates a filter ID prefixed with 'dag-duotone-'", () => {
		expect(getDagDuotoneFilterId('elem-1')).toBe('dag-duotone-elem-1');
	});

	it('handles empty string', () => {
		expect(getDagDuotoneFilterId('')).toBe('dag-duotone-');
	});
});

// ---------------------------------------------------------------------------
// mapDagBlendModeToCss
// ---------------------------------------------------------------------------

describe('mapDagBlendModeToCss', () => {
	it('returns undefined for undefined input', () => {
		expect(mapDagBlendModeToCss(undefined)).toBeUndefined();
	});

	it("maps 'mult' to 'multiply'", () => {
		expect(mapDagBlendModeToCss('mult')).toBe('multiply');
	});

	it("maps 'screen' to 'screen'", () => {
		expect(mapDagBlendModeToCss('screen')).toBe('screen');
	});

	it("maps 'darken' to 'darken'", () => {
		expect(mapDagBlendModeToCss('darken')).toBe('darken');
	});

	it("maps 'lighten' to 'lighten'", () => {
		expect(mapDagBlendModeToCss('lighten')).toBe('lighten');
	});

	it("returns undefined for 'over' (normal blend)", () => {
		expect(mapDagBlendModeToCss('over')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// hasDuotoneEffect
// ---------------------------------------------------------------------------

describe('hasDuotoneEffect', () => {
	it('returns false for a shape element (not image-like)', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		expect(hasDuotoneEffect(el)).toBeFalsy();
	});

	it('returns false for an image without duotone effects', () => {
		const el = {
			id: 'i1',
			type: 'image',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageUrl: 'data:image/png;base64,abc',
		} as PptxElement;
		expect(hasDuotoneEffect(el)).toBeFalsy();
	});

	it('returns true for an image with duotone effects', () => {
		const el = {
			id: 'i1',
			type: 'image',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageUrl: 'data:image/png;base64,abc',
			imageEffects: {
				duotone: { color1: '#000000', color2: '#FFFFFF' },
			},
		} as PptxElement;
		expect(hasDuotoneEffect(el)).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// getDuotoneColors
// ---------------------------------------------------------------------------

describe('getDuotoneColors', () => {
	it('returns undefined for a non-image element', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		expect(getDuotoneColors(el)).toBeUndefined();
	});

	it('returns undefined for an image without duotone', () => {
		const el = {
			id: 'i1',
			type: 'image',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageUrl: 'data:image/png;base64,abc',
		} as PptxElement;
		expect(getDuotoneColors(el)).toBeUndefined();
	});

	it('returns the duotone colour pair for an image with duotone', () => {
		const el = {
			id: 'i1',
			type: 'image',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageUrl: 'data:image/png;base64,abc',
			imageEffects: {
				duotone: { color1: '#112233', color2: '#AABBCC' },
			},
		} as PptxElement;
		const result = getDuotoneColors(el);
		expect(result).toStrictEqual({ color1: '#112233', color2: '#AABBCC' });
	});
});

// ---------------------------------------------------------------------------
// buildLineShadowCss
// ---------------------------------------------------------------------------

describe('buildLineShadowCss', () => {
	it('returns undefined for elements without shape properties', () => {
		const el = {
			id: 'c1',
			type: 'chart',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		expect(buildLineShadowCss(el)).toBeUndefined();
	});

	it('returns undefined when no line shadow colour is set', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: {},
		} as PptxElement;
		expect(buildLineShadowCss(el)).toBeUndefined();
	});

	it('returns undefined when line shadow colour is transparent', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: { lineShadowColor: 'transparent' },
		} as PptxElement;
		expect(buildLineShadowCss(el)).toBeUndefined();
	});

	it('returns a box-shadow string with default offsets when colour is set', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: { lineShadowColor: '#FF0000' },
		} as PptxElement;
		const result = buildLineShadowCss(el);
		expect(result).toBeDefined();
		// Default offsets are 2px 2px 4px
		expect(result).toContain('2px 2px 4px');
		expect(result).toContain('rgba(');
	});

	it('uses provided offset and blur values', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: {
				lineShadowColor: '#000000',
				lineShadowOffsetX: 5,
				lineShadowOffsetY: 10,
				lineShadowBlur: 8,
				lineShadowOpacity: 0.5,
			},
		} as PptxElement;
		const result = buildLineShadowCss(el);
		expect(result).toBeDefined();
		expect(result).toContain('5px 10px 8px');
	});
});

// ---------------------------------------------------------------------------
// buildLineGlowFilter
// ---------------------------------------------------------------------------

describe('buildLineGlowFilter', () => {
	it('returns undefined for elements without shape properties', () => {
		const el = {
			id: 'c1',
			type: 'chart',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		expect(buildLineGlowFilter(el)).toBeUndefined();
	});

	it('returns undefined when no line glow is set', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: {},
		} as PptxElement;
		expect(buildLineGlowFilter(el)).toBeUndefined();
	});

	it('returns undefined when line glow colour is transparent', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: { lineGlowColor: 'transparent', lineGlowRadius: 10 },
		} as PptxElement;
		expect(buildLineGlowFilter(el)).toBeUndefined();
	});

	it('returns undefined when line glow radius is missing', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: { lineGlowColor: '#FFFF00' },
		} as PptxElement;
		expect(buildLineGlowFilter(el)).toBeUndefined();
	});

	it('returns a drop-shadow filter string when colour and radius are set', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: {
				lineGlowColor: '#FFFF00',
				lineGlowRadius: 10,
				lineGlowOpacity: 0.8,
			},
		} as PptxElement;
		const result = buildLineGlowFilter(el);
		expect(result).toBeDefined();
		expect(result).toContain('drop-shadow(');
		expect(result).toContain('10px');
	});

	it('uses default opacity of 0.75 when not specified', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: {
				lineGlowColor: '#00FF00',
				lineGlowRadius: 5,
			},
		} as PptxElement;
		const result = buildLineGlowFilter(el);
		expect(result).toBeDefined();
		expect(result).toContain('drop-shadow(');
	});
});

// ---------------------------------------------------------------------------
// hasDagDuotoneEffect
// ---------------------------------------------------------------------------

describe('hasDagDuotoneEffect', () => {
	it('returns false for elements without shape properties', () => {
		const el = {
			id: 'c1',
			type: 'chart',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;
		expect(hasDagDuotoneEffect(el)).toBeFalsy();
	});

	it('returns false when no DAG duotone is set', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: {},
		} as PptxElement;
		expect(hasDagDuotoneEffect(el)).toBeFalsy();
	});

	it('returns true when DAG duotone is set', () => {
		const el = {
			id: 's1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			shapeStyle: {
				dagDuotone: { color1: '#000', color2: '#FFF' },
			},
		} as PptxElement;
		expect(hasDagDuotoneEffect(el)).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Image alpha primitives filter
// ---------------------------------------------------------------------------

const makeImg = (effects: Record<string, unknown>): PptxElement =>
	({
		id: 'img-x',
		type: 'image',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imageEffects: effects,
	}) as PptxElement;

describe('getImageAlphaFilterId', () => {
	it('prefixes the element id with imgalpha-', () => {
		expect(getImageAlphaFilterId('e1')).toBe('imgalpha-e1');
	});
});

describe('hasAdvancedImageAlphaEffects', () => {
	it('returns false for plain image (no imageEffects)', () => {
		expect(hasAdvancedImageAlphaEffects({ id: '1', type: 'image' } as PptxElement)).toBeFalsy();
	});

	it('returns false for css-expressible effects only (brightness/contrast)', () => {
		expect(hasAdvancedImageAlphaEffects(makeImg({ brightness: 10, contrast: -5 }))).toBeFalsy();
	});

	it('returns true when alphaInv is set', () => {
		expect(hasAdvancedImageAlphaEffects(makeImg({ alphaInv: {} }))).toBeTruthy();
	});

	it('returns true when alphaModFix is set', () => {
		expect(hasAdvancedImageAlphaEffects(makeImg({ alphaModFix: 50 }))).toBeTruthy();
	});

	it('returns true when biLevel threshold is set', () => {
		expect(hasAdvancedImageAlphaEffects(makeImg({ biLevel: 30 }))).toBeTruthy();
	});

	it('returns true when clrRepl is set', () => {
		expect(hasAdvancedImageAlphaEffects(makeImg({ clrRepl: { color: '#FF0000' } }))).toBeTruthy();
	});
});

describe('renderImageAlphaSvgFilter', () => {
	it('returns null when there are no advanced effects', () => {
		expect(renderImageAlphaSvgFilter(makeImg({ brightness: 10 }))).toBeNull();
	});

	it('emits an alphaInv feFuncA primitive', () => {
		const html = renderToStaticMarkup(renderImageAlphaSvgFilter(makeImg({ alphaInv: {} }))!);
		expect(html).toContain('id="imgalpha-img-x"');
		expect(html).toContain('<feFuncA type="linear" slope="-1" intercept="1"');
	});

	it('emits an alpha-multiplier matrix for alphaModFix', () => {
		const html = renderToStaticMarkup(renderImageAlphaSvgFilter(makeImg({ alphaModFix: 50 }))!);
		expect(html).toContain('0 0 0 0.5 0');
	});

	it('emits a 10-step alpha threshold table for alphaBiLevel', () => {
		const html = renderToStaticMarkup(renderImageAlphaSvgFilter(makeImg({ alphaBiLevel: 50 }))!);
		expect(html).toMatch(/<feFuncA type="discrete" tableValues="0 0 0 0 0 1 1 1 1 1"/);
	});

	it('uses distinct RGB transfer tables for distinct biLevel thresholds', () => {
		const low = renderToStaticMarkup(renderImageAlphaSvgFilter(makeImg({ biLevel: 25 }))!);
		const high = renderToStaticMarkup(renderImageAlphaSvgFilter(makeImg({ biLevel: 75 }))!);
		expect(low).not.toBe(high);
		expect(low).toContain(`tableValues="${`${'0 '.repeat(25)}${'1 '.repeat(76)}`.trim()}"`);
	});

	it('renders HSL luminance and positive and negative tint transfers', () => {
		const lighter = renderToStaticMarkup(
			renderImageAlphaSvgFilter(makeImg({ hsl: { lum: 40 }, tint: { amt: 25 } }))!,
		);
		const darker = renderToStaticMarkup(
			renderImageAlphaSvgFilter(makeImg({ tint: { hue: 45, amt: -30 } }))!,
		);
		expect(lighter).toContain('slope="0.6" intercept="0.4"');
		expect(lighter).toContain('slope="0.75" intercept="0.25"');
		expect(darker).toContain('type="hueRotate" values="45"');
		expect(darker).toContain('slope="0.7" intercept="0"');
	});

	it('emits an alphaCeiling and alphaFloor pair when both set', () => {
		const html = renderToStaticMarkup(
			renderImageAlphaSvgFilter(makeImg({ alphaCeiling: true, alphaFloor: true }))!,
		);
		expect(html).toContain('<feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1"');
		expect(html).toContain('<feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 1"');
	});

	it('emits a clrRepl colour matrix that maps to a constant RGB', () => {
		const html = renderToStaticMarkup(
			renderImageAlphaSvgFilter(makeImg({ clrRepl: { color: '#FF0000' } }))!,
		);
		expect(html).toContain('0 0 0 0 1');
		expect(html).toContain('0 0 0 1 0');
	});

	it('chains effects with progressing result names so the filter pipeline composes', () => {
		const html = renderToStaticMarkup(
			renderImageAlphaSvgFilter(makeImg({ alphaModFix: 80, alphaInv: {}, alphaBiLevel: 50 }))!,
		);
		expect(html).toContain('result="r0"');
		expect(html).toContain('result="r1"');
		expect(html).toContain('result="r2"');
	});
});
