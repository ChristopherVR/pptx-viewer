import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	getArtisticFilterId,
	getArtisticImageFilter,
	getComputedImageStyle,
	getImageDuotoneFilterId,
	getDuotoneImageFilter,
	getImageAlphaFilter,
	getImageAlphaFilterId,
	getImageEffectsOpacity,
	getImageFilterCss,
	getImageSvgFilters,
	hasAdvancedImageAlphaEffects,
	needsSvgArtisticFilter,
} from './image-effects';

/** Build an image element with the given effects. */
function image(effects?: PptxImageEffects, id = 'img1'): PptxElement {
	return {
		type: 'image',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imageEffects: effects,
	} as PptxElement;
}

/** Build a non-image element (shape). */
function shape(): PptxElement {
	return { type: 'shape', id: 's1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
}

describe('getImageFilterCss', () => {
	it('returns undefined for non-image elements', () => {
		expect(getImageFilterCss(shape())).toBeUndefined();
	});

	it('returns undefined when there are no effects', () => {
		expect(getImageFilterCss(image())).toBeUndefined();
		expect(getImageFilterCss(image({}))).toBeUndefined();
	});

	it('maps brightness (hundredths-of-percent) to a CSS multiplier', () => {
		expect(getImageFilterCss(image({ brightness: 20 }))).toBe('brightness(1.2)');
		expect(getImageFilterCss(image({ brightness: -50 }))).toBe('brightness(0.5)');
	});

	it('clamps brightness multiplier at zero', () => {
		expect(getImageFilterCss(image({ brightness: -200 }))).toBe('brightness(0)');
	});

	it('maps contrast and saturation to multipliers', () => {
		expect(getImageFilterCss(image({ contrast: 10 }))).toBe('contrast(1.1)');
		expect(getImageFilterCss(image({ saturation: -100 }))).toBe('saturate(0)');
	});

	it('emits grayscale(100%)', () => {
		expect(getImageFilterCss(image({ grayscale: true }))).toBe('grayscale(100%)');
	});

	it('ignores zero-valued brightness/contrast/saturation', () => {
		expect(getImageFilterCss(image({ brightness: 0, contrast: 0, saturation: 0 }))).toBeUndefined();
	});

	it('combines multiple effects in precedence order', () => {
		expect(getImageFilterCss(image({ brightness: 10, contrast: 20, saturation: 30 }))).toBe(
			'brightness(1.1) contrast(1.2) saturate(1.3)',
		);
	});

	it('references the duotone SVG filter via url(#id)', () => {
		const css = getImageFilterCss(image({ duotone: { color1: '#000000', color2: '#ffffff' } }));
		expect(css).toBe(`url(#${getImageDuotoneFilterId('img1')})`);
	});

	it('omits the duotone reference when excludeDuotone is set', () => {
		const css = getImageFilterCss(image({ duotone: { color1: '#000000', color2: '#ffffff' } }), {
			excludeDuotone: true,
		});
		expect(css).toBeUndefined();
	});

	it('uses CSS approximations for simple artistic effects', () => {
		expect(getImageFilterCss(image({ artisticEffect: 'photocopy' }))).toBe(
			'grayscale(100%) contrast(200%) brightness(120%)',
		);
		expect(getImageFilterCss(image({ artisticEffect: 'blur', artisticRadius: 8 }))).toBe(
			'blur(8px)',
		);
	});

	it('references the artistic SVG filter for complex effects', () => {
		const css = getImageFilterCss(image({ artisticEffect: 'filmGrain' }));
		expect(css).toBe(`url(#${getArtisticFilterId('img1')})`);
	});

	it('falls back to a mild filter for unknown artistic effects', () => {
		expect(getImageFilterCss(image({ artisticEffect: 'totallyUnknown' }))).toBe(
			'contrast(105%) saturate(105%)',
		);
	});

	it('maps biLevel only through its threshold-aware SVG filter', () => {
		const css = getImageFilterCss(image({ biLevel: 50 }));
		expect(css).toContain(`url(#${getImageAlphaFilterId('img1')})`);
		expect(css).not.toContain('contrast(1000%)');
	});
});

describe('getImageEffectsOpacity', () => {
	it('returns alphaModFix as a 0-1 opacity', () => {
		expect(getImageEffectsOpacity(image({ alphaModFix: 50 }))).toBe(0.5);
	});

	it('returns undefined when alphaModFix is absent', () => {
		expect(getImageEffectsOpacity(image({}))).toBeUndefined();
		expect(getImageEffectsOpacity(shape())).toBeUndefined();
	});
});

describe('getDuotoneImageFilter', () => {
	it('returns a filter def with id, cssReference, and markup', () => {
		const f = getDuotoneImageFilter(image({ duotone: { color1: '#000000', color2: '#ffffff' } }));
		expect(f).toBeDefined();
		expect(f?.id).toBe(getImageDuotoneFilterId('img1'));
		expect(f?.cssReference).toBe(`url(#${getImageDuotoneFilterId('img1')})`);
		expect(f?.filterMarkup).toContain('<feColorMatrix');
		expect(f?.filterMarkup).toContain('<feComponentTransfer>');
		// shadow #000000 → intercept 0, highlight #ffffff → slope 1
		expect(f?.filterMarkup).toContain('slope="1" intercept="0"');
	});

	it('returns undefined without a duotone effect', () => {
		expect(getDuotoneImageFilter(image({}))).toBeUndefined();
		expect(getDuotoneImageFilter(shape())).toBeUndefined();
	});
});

describe('getImageAlphaFilter', () => {
	it('builds an alpha filter for advanced primitives', () => {
		const f = getImageAlphaFilter(image({ alphaInv: {} }));
		expect(f).toBeDefined();
		expect(f?.id).toBe(getImageAlphaFilterId('img1'));
		expect(f?.cssReference).toBe(`url(#${getImageAlphaFilterId('img1')})`);
		expect(f?.filterMarkup).toContain('<feComponentTransfer');
		expect(f?.filterMarkup).toContain('SourceGraphic');
	});

	it('chains primitives with sequential in/result refs', () => {
		const f = getImageAlphaFilter(image({ alphaModFix: 50, biLevel: 50 }));
		expect(f?.filterMarkup).toContain('in="SourceGraphic" result="r0"');
		expect(f?.filterMarkup).toContain('result="r1"');
	});

	it('uses the actual bi-level threshold instead of a fixed transfer', () => {
		const low = getImageAlphaFilter(image({ biLevel: 25 }))?.filterMarkup;
		const high = getImageAlphaFilter(image({ biLevel: 75 }))?.filterMarkup;
		expect(low).not.toBe(high);
		expect(low).toContain(`tableValues="${`${'0 '.repeat(25)}${'1 '.repeat(76)}`.trim()}"`);
	});

	it('renders HSL luminance and both positive and negative tint amounts', () => {
		const lighter = getImageAlphaFilter(image({ hsl: { lum: 40 }, tint: { amt: 25 } }));
		const darker = getImageAlphaFilter(image({ tint: { hue: 45, amt: -30 } }));
		expect(lighter?.filterMarkup).toContain('slope="0.6" intercept="0.4"');
		expect(lighter?.filterMarkup).toContain('slope="0.75" intercept="0.25"');
		expect(darker?.filterMarkup).toContain('type="hueRotate" values="45"');
		expect(darker?.filterMarkup).toContain('slope="0.7" intercept="0"');
	});

	it('returns undefined without advanced primitives', () => {
		expect(getImageAlphaFilter(image({ brightness: 10 }))).toBeUndefined();
	});
});

describe('hasAdvancedImageAlphaEffects', () => {
	it('detects advanced primitives', () => {
		expect(hasAdvancedImageAlphaEffects(image({ alphaCeiling: true }))).toBeTruthy();
		expect(hasAdvancedImageAlphaEffects(image({ clrRepl: { color: '#ff0000' } }))).toBeTruthy();
		expect(hasAdvancedImageAlphaEffects(image({ biLevel: 30 }))).toBeTruthy();
	});

	it('returns false for plain recolour effects', () => {
		expect(hasAdvancedImageAlphaEffects(image({ brightness: 10, grayscale: true }))).toBeFalsy();
		expect(hasAdvancedImageAlphaEffects(shape())).toBeFalsy();
	});
});

describe('needsSvgArtisticFilter', () => {
	it('classifies complex vs simple effects', () => {
		expect(needsSvgArtisticFilter('filmGrain')).toBeTruthy();
		expect(needsSvgArtisticFilter('pencilSketch')).toBeTruthy();
		expect(needsSvgArtisticFilter('blur')).toBeFalsy();
		expect(needsSvgArtisticFilter(undefined)).toBeFalsy();
	});
});

describe('getArtisticImageFilter', () => {
	it('builds a filter def for complex effects', () => {
		const f = getArtisticImageFilter(image({ artisticEffect: 'cutout' }));
		expect(f).toBeDefined();
		expect(f?.id).toBe(getArtisticFilterId('img1'));
		expect(f?.filterMarkup).toContain('<feComponentTransfer>');
		expect(f?.filterMarkup).toContain('type="discrete"');
	});

	it('returns undefined for CSS-handled (simple) effects', () => {
		expect(getArtisticImageFilter(image({ artisticEffect: 'blur' }))).toBeUndefined();
		expect(getArtisticImageFilter(image({}))).toBeUndefined();
	});
});

describe('getImageSvgFilters', () => {
	it('collects all required defs in reference order', () => {
		const defs = getImageSvgFilters(
			image({ duotone: { color1: '#000000', color2: '#ffffff' }, alphaInv: {} }),
		);
		expect(defs.map((d) => d.id)).toStrictEqual([
			getImageDuotoneFilterId('img1'),
			getImageAlphaFilterId('img1'),
		]);
	});

	it('returns an empty array when no SVG filters are needed', () => {
		expect(getImageSvgFilters(image({ brightness: 10 }))).toStrictEqual([]);
		expect(getImageSvgFilters(shape())).toStrictEqual([]);
	});
});

describe('getComputedImageStyle', () => {
	it('returns filter + svgFilters for a duotone image', () => {
		const style = getComputedImageStyle(
			image({ duotone: { color1: '#000080', color2: '#ffd700' } }),
		);
		expect(style.filter).toBe(`url(#${getImageDuotoneFilterId('img1')})`);
		expect(style.svgFilters).toHaveLength(1);
		expect(style.svgFilters[0].id).toBe(getImageDuotoneFilterId('img1'));
	});

	it('returns filter without svg defs for simple recolour', () => {
		const style = getComputedImageStyle(image({ brightness: 20, contrast: -10 }));
		expect(style.filter).toBe('brightness(1.2) contrast(0.9)');
		expect(style.svgFilters).toStrictEqual([]);
	});

	it('returns no filter and empty defs when there are no effects', () => {
		const style = getComputedImageStyle(image({}));
		expect(style.filter).toBeUndefined();
		expect(style.svgFilters).toStrictEqual([]);
	});

	it('surfaces alphaModFix opacity', () => {
		const style = getComputedImageStyle(image({ alphaModFix: 40 }));
		expect(style.opacity).toBe(0.4);
	});
});
