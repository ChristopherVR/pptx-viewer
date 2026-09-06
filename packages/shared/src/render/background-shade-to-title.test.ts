import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	computeShadeToTitleFillToRect,
	parseGradientCssStops,
	resolveShadeToTitleBackgroundImage,
	resolveShadeToTitleRect,
} from './background-shade-to-title';

function slide(overrides: Partial<PptxSlide>): PptxSlide {
	return { id: 'slide1', rId: 'rId1', slideNumber: 1, elements: [], ...overrides };
}

function titleElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'title1',
		type: 'text',
		x: 120,
		y: 88,
		width: 720,
		height: 188,
		text: 'My Title',
		placeholderType: 'ctrTitle',
		...overrides,
	} as unknown as PptxElement;
}

describe('resolveShadeToTitleRect', () => {
	it('returns the bounds of the slide own title/ctrTitle placeholder', () => {
		expect(resolveShadeToTitleRect(slide({ elements: [titleElement()] }))).toStrictEqual({
			x: 120,
			y: 88,
			width: 720,
			height: 188,
		});
	});

	it('is case-insensitive on placeholderType', () => {
		expect(
			resolveShadeToTitleRect(slide({ elements: [titleElement({ placeholderType: 'Title' })] })),
		).toStrictEqual({ x: 120, y: 88, width: 720, height: 188 });
	});

	it('returns undefined when the slide has no title placeholder', () => {
		const body = titleElement({ placeholderType: 'body' });
		expect(resolveShadeToTitleRect(slide({ elements: [body] }))).toBeUndefined();
	});

	it('returns undefined for a title placeholder with no usable size', () => {
		const zeroSize = titleElement({ width: 0, height: 0 });
		expect(resolveShadeToTitleRect(slide({ elements: [zeroSize] }))).toBeUndefined();
	});

	it('returns undefined for a slide with no elements', () => {
		expect(resolveShadeToTitleRect(slide({ elements: [] }))).toBeUndefined();
	});
});

describe('computeShadeToTitleFillToRect', () => {
	it('converts title px bounds to slide-relative fillToRect insets', () => {
		// The COM-measured fixture: 960x540pt slide, ctrTitle at Left=120
		// Top=88.37504 Width=720 Height=188.
		const rect = computeShadeToTitleFillToRect(
			{ x: 120, y: 88.37504, width: 720, height: 188 },
			960,
			540,
		);
		expect(rect).toBeDefined();
		expect(rect!.l).toBeCloseTo(0.125, 5);
		expect(rect!.t).toBeCloseTo(0.163657, 5);
		expect(rect!.r).toBeCloseTo(0.125, 5);
		expect(rect!.b).toBeCloseTo(0.488194, 5);
	});

	it('returns undefined for a non-positive slide size', () => {
		expect(
			computeShadeToTitleFillToRect({ x: 0, y: 0, width: 10, height: 10 }, 0, 540),
		).toBeUndefined();
		expect(
			computeShadeToTitleFillToRect({ x: 0, y: 0, width: 10, height: 10 }, 960, 0),
		).toBeUndefined();
	});
});

describe('parseGradientCssStops', () => {
	it('parses hex stops out of a linear-gradient string', () => {
		const css = 'linear-gradient(90.00deg, #000000 0%, #0000ff 100%)';
		expect(parseGradientCssStops(css)).toStrictEqual([
			{ position: 0, color: '#000000' },
			{ position: 100, color: '#0000ff' },
		]);
	});

	it('parses rgba stops into hex + opacity', () => {
		const css = 'linear-gradient(90.00deg, rgba(255, 0, 0, 0.5) 0%, #00ff00 100%)';
		expect(parseGradientCssStops(css)).toStrictEqual([
			{ position: 0, color: '#ff0000', opacity: 0.5 },
			{ position: 100, color: '#00ff00' },
		]);
	});

	it('ignores the "at 50% 50%" position keyword of a radial-gradient wrapper', () => {
		const css = 'radial-gradient(75% 75% at 50% 50%, #000000 0%, #0000ff 100%)';
		expect(parseGradientCssStops(css)).toStrictEqual([
			{ position: 0, color: '#000000' },
			{ position: 100, color: '#0000ff' },
		]);
	});

	it('returns an empty array for a gradient with no stop tokens', () => {
		expect(parseGradientCssStops('none')).toStrictEqual([]);
	});
});

describe('resolveShadeToTitleBackgroundImage', () => {
	const gradientSlide = slide({
		backgroundShadeToTitle: true,
		backgroundGradient: 'linear-gradient(90.00deg, #0000ff 0%, #00ff00 100%)',
		elements: [titleElement()],
	});

	it('builds a rect-path gradient data URI when everything is available', () => {
		const image = resolveShadeToTitleBackgroundImage(gradientSlide, 960, 540);
		expect(image).toBeDefined();
		expect(image).toMatch(/^url\("data:image\/svg\+xml,/u);
		expect(image).not.toBe(gradientSlide.backgroundGradient);
	});

	it('returns undefined when shadeToTitle is not set', () => {
		expect(
			resolveShadeToTitleBackgroundImage(
				slide({ ...gradientSlide, backgroundShadeToTitle: false }),
				960,
				540,
			),
		).toBeUndefined();
	});

	it('returns undefined when the slide has no gradient background', () => {
		expect(
			resolveShadeToTitleBackgroundImage(
				slide({ backgroundShadeToTitle: true, elements: [titleElement()] }),
				960,
				540,
			),
		).toBeUndefined();
	});

	it('returns undefined when the caller supplies no slide size', () => {
		expect(resolveShadeToTitleBackgroundImage(gradientSlide, undefined, undefined)).toBeUndefined();
	});

	it('returns undefined when the slide has no title placeholder', () => {
		expect(
			resolveShadeToTitleBackgroundImage(slide({ ...gradientSlide, elements: [] }), 960, 540),
		).toBeUndefined();
	});
});
