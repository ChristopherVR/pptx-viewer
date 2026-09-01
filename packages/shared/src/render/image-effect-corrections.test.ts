import type { PptxImageEffects } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	getImageCorrectionsFilterTokens,
	getImageSharpenFilter,
	getImageSharpenFilterId,
} from './image-effect-corrections';

describe('getImageCorrectionsFilterTokens', () => {
	it('returns no tokens for an empty effects object', () => {
		expect(getImageCorrectionsFilterTokens({} as PptxImageEffects)).toStrictEqual([]);
	});

	it('maps brightnessContrast to brightness()/contrast() at 1/100000 precision', () => {
		const tokens = getImageCorrectionsFilterTokens({
			brightnessContrast: { bright: 50000, contrast: -25000 },
		} as PptxImageEffects);
		expect(tokens).toContain('brightness(1.5)');
		expect(tokens).toContain('contrast(0.75)');
	});

	it('omits zero brightness/contrast', () => {
		const tokens = getImageCorrectionsFilterTokens({
			brightnessContrast: { bright: 0, contrast: 0 },
		} as PptxImageEffects);
		expect(tokens).toStrictEqual([]);
	});

	it('maps colorSaturation to saturate()', () => {
		expect(
			getImageCorrectionsFilterTokens({
				colorSaturation: { sat: 100000 },
			} as PptxImageEffects),
		).toStrictEqual(['saturate(1)']);
		expect(
			getImageCorrectionsFilterTokens({ colorSaturation: { sat: 0 } } as PptxImageEffects),
		).toStrictEqual(['saturate(0)']);
		expect(
			getImageCorrectionsFilterTokens({
				colorSaturation: { sat: 400000 },
			} as PptxImageEffects),
		).toStrictEqual(['saturate(4)']);
	});

	it('produces no colour-temperature token at the 6500K neutral point', () => {
		expect(
			getImageCorrectionsFilterTokens({
				colorTemperature: { colorTemp: 6500 },
			} as PptxImageEffects),
		).toStrictEqual([]);
	});

	it('warms with sepia + negative hue-rotate below 6500K', () => {
		const tokens = getImageCorrectionsFilterTokens({
			colorTemperature: { colorTemp: 1500 },
		} as PptxImageEffects);
		expect(tokens).toHaveLength(1);
		expect(tokens[0]).toMatch(/^sepia\(\d+%\) hue-rotate\(-\d+deg\)$/);
	});

	it('cools with hue-rotate above 6500K', () => {
		const tokens = getImageCorrectionsFilterTokens({
			colorTemperature: { colorTemp: 11500 },
		} as PptxImageEffects);
		expect(tokens).toHaveLength(1);
		expect(tokens[0]).toMatch(/^hue-rotate\(\d+deg\) saturate\(\d+%\)$/);
	});

	it('maps a negative sharpenSoften amount to a small CSS blur', () => {
		const tokens = getImageCorrectionsFilterTokens({
			sharpenSoften: { amount: -100000 },
		} as PptxImageEffects);
		expect(tokens).toStrictEqual(['blur(3.00px)']);
	});

	it('does not emit a CSS blur token for a positive (sharpen) amount', () => {
		const tokens = getImageCorrectionsFilterTokens({
			sharpenSoften: { amount: 50000 },
		} as PptxImageEffects);
		expect(tokens).toStrictEqual([]);
	});

	it('combines multiple corrections in one call', () => {
		const tokens = getImageCorrectionsFilterTokens({
			brightnessContrast: { bright: 10000 },
			colorSaturation: { sat: 150000 },
		} as PptxImageEffects);
		expect(tokens).toStrictEqual(['brightness(1.1)', 'saturate(1.5)']);
	});
});

describe('getImageSharpenFilter', () => {
	it('returns undefined when there is no sharpenSoften', () => {
		expect(getImageSharpenFilter({} as PptxImageEffects, 'el1')).toBeUndefined();
	});

	it('returns undefined for a negative (soften) amount', () => {
		expect(
			getImageSharpenFilter({ sharpenSoften: { amount: -50000 } } as PptxImageEffects, 'el1'),
		).toBeUndefined();
	});

	it('returns undefined for a zero amount', () => {
		expect(
			getImageSharpenFilter({ sharpenSoften: { amount: 0 } } as PptxImageEffects, 'el1'),
		).toBeUndefined();
	});

	it('builds a feConvolveMatrix filter for a positive amount', () => {
		const result = getImageSharpenFilter(
			{ sharpenSoften: { amount: 100000 } } as PptxImageEffects,
			'el1',
		);
		expect(result).toBeDefined();
		expect(result?.id).toBe(getImageSharpenFilterId('el1'));
		expect(result?.cssReference).toBe(`url(#${getImageSharpenFilterId('el1')})`);
		expect(result?.filterMarkup).toContain('feConvolveMatrix');
		expect(result?.filterMarkup).toContain('preserveAlpha="true"');
	});

	it('produces a kernel whose terms sum to 1 (brightness-preserving)', () => {
		const result = getImageSharpenFilter(
			{ sharpenSoften: { amount: 60000 } } as PptxImageEffects,
			'el2',
		);
		const match = result?.filterMarkup.match(/kernelMatrix="([^"]+)"/);
		expect(match).toBeTruthy();
		const values = (match![1] as string).split(' ').map(Number);
		const sum = values.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(1, 5);
	});
});
