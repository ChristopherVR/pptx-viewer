import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { translationsEn } from '../../i18n/translations-en';
import { getImageFilterCss, getImageSvgFilters } from '../image-effects';
import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';
import type { RibbonGalleryId } from './gallery-types';
import { accentDuotone, mixHex, resolveAccentHex, signedPercent } from './picture-adjust-catalog';
import { mergeImageEffects } from './picture-adjust-gallery';
import { PICTURE_ARTISTIC_EFFECT_NAMES } from './picture-artistic-gallery';

function picture(imageEffects?: PptxImageEffects): PptxElement {
	return {
		id: 'p1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 200,
		height: 150,
		shapeStyle: {},
		...(imageEffects && { imageEffects }),
	} as unknown as PptxElement;
}

function effectsAfter(
	gallery: RibbonGalleryId,
	itemId: string,
	element: PptxElement,
	themeColorMap?: Record<string, string>,
): PptxImageEffects {
	const result = applyRibbonGalleryItem(gallery, itemId, { element, themeColorMap });
	if (result?.kind !== 'element') {
		throw new Error(`no patch for ${gallery}/${itemId}`);
	}
	return (result.patch as { imageEffects: PptxImageEffects }).imageEffects;
}

function items(gallery: RibbonGalleryId, element: PptxElement | null = picture()) {
	return buildRibbonGallery(gallery, { element }).sections.flatMap((s) => s.items);
}

function appliedIds(gallery: RibbonGalleryId, element: PptxElement): string[] {
	return items(gallery, element)
		.filter((i) => i.applied)
		.map((i) => i.id);
}

const ADJUST: RibbonGalleryId[] = ['pictureCorrections', 'pictureColor', 'pictureArtisticEffects'];

describe('picture adjust galleries: shape', () => {
	it.each(ADJUST)('%s is disabled without a picture and ignores foreign picks', (gallery) => {
		expect(buildRibbonGallery(gallery, { element: null }).disabled).toBeTruthy();
		const shape = { ...picture(), type: 'shape' } as unknown as PptxElement;
		expect(buildRibbonGallery(gallery, { element: shape }).disabled).toBeTruthy();
		const first = items(gallery)[0].id;
		expect(applyRibbonGalleryItem(gallery, first, { element: shape })).toBeNull();
		expect(applyRibbonGalleryItem(gallery, 'nope', { element: picture() })).toBeNull();
	});

	it.each(ADJUST)('%s tiles have unique ids, English labels and preview svgs', (gallery) => {
		const all = items(gallery);
		expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
		for (const item of all) {
			expect(translationsEn[item.labelKey]).toBeDefined();
			expect(item.previewSvg.startsWith('<svg')).toBeTruthy();
		}
		const ids = all.map((i) => `padj-${gallery}-${i.id}`.replace(/[^\w-]/gu, '_'));
		for (const id of ids) {
			expect(all.filter((i) => i.previewSvg.includes(`id="${id}-c"`))).toHaveLength(1);
		}
	});

	it('offers 5 sharpen/soften presets and a 5x5 brightness/contrast grid', () => {
		const d = buildRibbonGallery('pictureCorrections', { element: picture() });
		expect(d.sections.map((s) => s.items.length)).toStrictEqual([5, 25]);
		expect(d.sections[1].items[0].id).toBe('bc_b-40_c-40');
		expect(d.sections[1].items[12].id).toBe('bcNormal');
	});

	it('offers saturation, tone and recolor sections', () => {
		const d = buildRibbonGallery('pictureColor', { element: picture() });
		expect(d.sections.map((s) => s.id)).toStrictEqual(['saturation', 'tone', 'recolor']);
		expect(d.sections.map((s) => s.items.length)).toStrictEqual([9, 9, 19]);
	});
});

describe('picture adjust galleries: corrections mapping', () => {
	it('writes a14 sharpenSoften in 1/1000ths of a percent and clears it for normal', () => {
		expect(effectsAfter('pictureCorrections', 'soften50', picture()).sharpenSoften).toStrictEqual({
			amount: -50000,
		});
		expect(effectsAfter('pictureCorrections', 'sharpen25', picture()).sharpenSoften).toStrictEqual({
			amount: 25000,
		});
		const cleared = effectsAfter(
			'pictureCorrections',
			'sharpenNormal',
			picture({ sharpenSoften: { amount: 50000 } }),
		);
		expect('sharpenSoften' in cleared).toBeFalsy();
	});

	it('writes a14 brightnessContrast and keeps unrelated effects', () => {
		const fx = effectsAfter(
			'pictureCorrections',
			'bc_b20_c-40',
			picture({ grayscale: true, colorSaturation: { sat: 200000 } }),
		);
		expect(fx.brightnessContrast).toStrictEqual({ bright: 20000, contrast: -40000 });
		expect(fx.grayscale).toBeTruthy();
		expect(fx.colorSaturation).toStrictEqual({ sat: 200000 });
		const oneAxis = effectsAfter('pictureCorrections', 'bc_b0_c20', picture());
		expect(oneAxis.brightnessContrast).toStrictEqual({ contrast: 20000 });
		expect(
			'brightnessContrast' in
				effectsAfter(
					'pictureCorrections',
					'bcNormal',
					picture({ brightnessContrast: { bright: 1000 } }),
				),
		).toBeFalsy();
	});

	it('marks exactly the applied presets, and Normal when nothing is set', () => {
		expect(appliedIds('pictureCorrections', picture())).toStrictEqual([
			'sharpenNormal',
			'bcNormal',
		]);
		const el = picture({
			sharpenSoften: { amount: -25000 },
			brightnessContrast: { bright: -40000, contrast: 40000 },
		});
		expect(appliedIds('pictureCorrections', el)).toStrictEqual(['soften25', 'bc_b-40_c40']);
	});

	it('renders through the shared image filter', () => {
		const el = picture(effectsAfter('pictureCorrections', 'bc_b40_c20', picture()));
		expect(getImageFilterCss(el)).toBe('brightness(1.4) contrast(1.2)');
		const soft = picture(effectsAfter('pictureCorrections', 'soften50', picture()));
		expect(getImageFilterCss(soft)).toContain('blur(');
		const sharp = picture(effectsAfter('pictureCorrections', 'sharpen50', picture()));
		expect(getImageSvgFilters(sharp).length).toBeGreaterThan(0);
	});
});

describe('picture adjust galleries: color mapping', () => {
	it('writes a14 saturation and temperature, clearing them at the neutral preset', () => {
		expect(effectsAfter('pictureColor', 'saturation200', picture()).colorSaturation).toStrictEqual({
			sat: 200000,
		});
		expect(effectsAfter('pictureColor', 'tone4700', picture()).colorTemperature).toStrictEqual({
			colorTemp: 4700,
		});
		expect(
			'colorSaturation' in
				effectsAfter('pictureColor', 'saturationNormal', picture({ colorSaturation: { sat: 0 } })),
		).toBeFalsy();
		expect(
			'colorTemperature' in
				effectsAfter(
					'pictureColor',
					'toneNormal',
					picture({ colorTemperature: { colorTemp: 4700 } }),
				),
		).toBeFalsy();
		expect(appliedIds('pictureColor', picture())).toStrictEqual([
			'saturationNormal',
			'toneNormal',
			'recolorNone',
		]);
	});

	it('maps recolors to grayscale, duotone, biLevel and washout, replacing the previous one', () => {
		expect(effectsAfter('pictureColor', 'recolorGrayscale', picture()).grayscale).toBeTruthy();
		expect(effectsAfter('pictureColor', 'recolorSepia', picture()).duotone).toStrictEqual({
			color1: '#000000',
			color2: '#D9C3A5',
		});
		expect(effectsAfter('pictureColor', 'recolorBlackWhite50', picture()).biLevel).toBe(50);
		expect(effectsAfter('pictureColor', 'recolorWashout', picture()).lum).toStrictEqual({
			bright: 70,
			contrast: -70,
		});
		const switched = effectsAfter(
			'pictureColor',
			'recolorGrayscale',
			picture(effectsAfter('pictureColor', 'recolorWashout', picture())),
		);
		expect(switched.lum).toBeUndefined();
		const cleared = effectsAfter(
			'pictureColor',
			'recolorNone',
			picture({ grayscale: true, biLevel: 25, duotone: { color1: '#000000', color2: '#FFFFFF' } }),
		);
		expect(cleared).toStrictEqual({});
	});

	it('marks the applied recolor', () => {
		for (const id of [
			'recolorGrayscale',
			'recolorSepia',
			'recolorWashout',
			'recolorBlackWhite75',
		]) {
			const el = picture(effectsAfter('pictureColor', id, picture()));
			expect(appliedIds('pictureColor', el)).toContain(id);
			expect(appliedIds('pictureColor', el)).not.toContain('recolorNone');
		}
	});

	it('builds accent recolors from the deck theme, dark and light', () => {
		const map = { accent2: '#E97132' };
		const dark = effectsAfter('pictureColor', 'recolorAccent2Dark', picture(), map);
		expect(dark.duotone).toStrictEqual({ color1: '#000000', color2: '#E97132' });
		const light = effectsAfter('pictureColor', 'recolorAccent2Light', picture(), map);
		expect(light.duotone).toStrictEqual({
			color1: mixHex('#E97132', '#000000', 0.45),
			color2: '#FFFFFF',
		});
		const el = picture(dark);
		const d = buildRibbonGallery('pictureColor', { element: el, themeColorMap: map });
		const applied = d.sections.flatMap((s) => s.items).filter((i) => i.applied);
		expect(applied.map((i) => i.id)).toStrictEqual([
			'saturationNormal',
			'toneNormal',
			'recolorAccent2Dark',
		]);
	});

	it('duotone and black-and-white tiles carry a real SVG filter, css ones a filter string', () => {
		const all = items('pictureColor');
		const sepia = all.find((i) => i.id === 'recolorSepia');
		const bw = all.find((i) => i.id === 'recolorBlackWhite50');
		const gray = all.find((i) => i.id === 'recolorGrayscale');
		expect(sepia?.previewSvg).toContain('feComponentTransfer');
		expect(bw?.previewSvg).toContain('feFuncR type="linear"');
		expect(gray?.previewFilter).toBe('grayscale(100%)');
		expect(gray?.previewSvg).toContain('style="filter:grayscale(100%)"');
		expect(items('pictureColor').find((i) => i.id === 'saturation400')?.previewFilter).toBe(
			'saturate(4)',
		);
	});

	it('renders recolors through the shared image filter', () => {
		const gray = picture(effectsAfter('pictureColor', 'recolorGrayscale', picture()));
		expect(getImageFilterCss(gray)).toContain('grayscale(100%)');
		const sepia = picture(effectsAfter('pictureColor', 'recolorSepia', picture()));
		expect(getImageSvgFilters(sepia).length).toBeGreaterThan(0);
	});
});

describe('picture adjust galleries: artistic effects', () => {
	it('offers no recolor or correction entries', () => {
		const ids = items('pictureArtisticEffects').map((i) => i.id);
		expect(ids[0]).toBe('artisticNone');
		for (const banned of ['grayscale', 'sepia', 'sharpen']) {
			expect(ids).not.toContain(banned);
		}
		expect(ids).toStrictEqual(
			PICTURE_ARTISTIC_EFFECT_NAMES.map((n) => (n === 'none' ? 'artisticNone' : n)),
		);
	});

	it('every offered effect renders something beyond the generic fallback', () => {
		const broken: string[] = [];
		for (const id of items('pictureArtisticEffects')
			.map((i) => i.id)
			.filter((i) => i !== 'artisticNone')) {
			const el = picture(effectsAfter('pictureArtisticEffects', id, picture()));
			const css = getImageFilterCss(el) ?? '';
			const generic = css === '' || css === 'contrast(105%) saturate(105%)';
			const missingSvg = css.includes('url(#artistic-fx-') && getImageSvgFilters(el).length === 0;
			if (generic || missingSvg) {
				broken.push(id);
			}
		}
		expect(broken).toStrictEqual([]);
	});

	it('writes artisticEffect, resets stale params, and none clears it', () => {
		const stale = picture({
			artisticEffect: 'blur',
			artisticRadius: 9,
			artisticParams: { radius: 9 },
		});
		const fx = effectsAfter('pictureArtisticEffects', 'paintStrokes', stale);
		expect(fx).toStrictEqual({ artisticEffect: 'paintStrokes' });
		expect(appliedIds('pictureArtisticEffects', picture(fx))).toStrictEqual(['paintStrokes']);
		expect(effectsAfter('pictureArtisticEffects', 'artisticNone', picture(fx))).toStrictEqual({});
		expect(appliedIds('pictureArtisticEffects', picture())).toStrictEqual(['artisticNone']);
	});
});

describe('picture adjust helpers', () => {
	it('formats, mixes and merges', () => {
		expect(signedPercent(20)).toBe('+20');
		expect(signedPercent(-40)).toBe('-40');
		expect(signedPercent(0)).toBe('0');
		expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
		expect(accentDuotone('#156082', 'dark').color2).toBe('#156082');
		expect(resolveAccentHex({ accent1: '156082' }, { key: 'accent1', fallback: '#000000' })).toBe(
			'#156082',
		);
		expect(resolveAccentHex(undefined, { key: 'accent1', fallback: '#123456' })).toBe('#123456');
		expect(
			mergeImageEffects({ grayscale: true }, { grayscale: undefined, biLevel: 5 }),
		).toStrictEqual({
			biLevel: 5,
		});
	});
});
