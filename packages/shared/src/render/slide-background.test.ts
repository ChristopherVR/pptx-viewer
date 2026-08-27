import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getSlideBackgroundStyle } from './slide-background';

function slide(overrides: Partial<PptxSlide>): PptxSlide {
	return { id: 'slide1', rId: 'rId1', slideNumber: 1, elements: [], ...overrides };
}

describe('getSlideBackgroundStyle', () => {
	it('renders a preset pattern over its background colour', () => {
		const style = getSlideBackgroundStyle(
			slide({
				backgroundColor: '#FF0000',
				backgroundPattern: { preset: 'pct10', fgColor: '#FF0000', bgColor: '#00FF00' },
			}),
		);

		expect(style['background-color']).toBe('#00FF00');
		expect(style['background-image']).toContain('data:image/svg+xml');
		expect(style['background-image']).toContain('%23FF0000');
		expect(style['background-image']).toContain('%2300FF00');
		expect(style['background-repeat']).toBe('repeat');
	});

	it('keeps the flat fallback for an unknown pattern preset', () => {
		const style = getSlideBackgroundStyle(
			slide({
				backgroundPattern: { preset: 'futurePattern', bgColor: '#123456' },
			}),
		);

		expect(style['background-color']).toBe('#123456');
		expect(style['background-image']).toBeUndefined();
	});

	it('gives an image fill precedence over a gradient', () => {
		const style = getSlideBackgroundStyle(
			slide({
				backgroundImage: 'data:image/png;base64,AAA',
				backgroundGradient: 'linear-gradient(#000, #fff)',
			}),
		);

		expect(style['background-image']).toBe('url(data:image/png;base64,AAA)');
	});

	it('gives a gradient precedence over a pattern', () => {
		const gradient = 'linear-gradient(#000, #fff)';
		const style = getSlideBackgroundStyle(
			slide({
				backgroundGradient: gradient,
				backgroundPattern: { preset: 'pct50', fgColor: '#000000', bgColor: '#FFFFFF' },
			}),
		);

		expect(style['background-image']).toBe(gradient);
	});

	it('shades the gradient toward the title colour when shadeToTitle is set', () => {
		const title: PptxElement = {
			id: 'title1',
			type: 'text',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			text: 'Title',
			textSegments: [{ text: 'Title', style: { color: '#FF0000' } }],
			rawXml: { 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': 'title' } } } },
		} as unknown as PptxElement;

		const style = getSlideBackgroundStyle(
			slide({
				backgroundGradient: 'linear-gradient(90.00deg, #000000 0%, #FFFFFF 100%)',
				backgroundShadeToTitle: true,
				elements: [title],
			}),
		);

		expect(style['background-image']).toBe('linear-gradient(90.00deg, #000000 0%, #FF0000 100%)');
	});

	it('leaves the gradient untouched when shadeToTitle is unset', () => {
		const gradient = 'linear-gradient(90.00deg, #000000 0%, #FFFFFF 100%)';
		const style = getSlideBackgroundStyle(slide({ backgroundGradient: gradient }));
		expect(style['background-image']).toBe(gradient);
	});

	it('leaves the gradient untouched when shadeToTitle is set but there is no title colour', () => {
		const gradient = 'linear-gradient(90.00deg, #000000 0%, #FFFFFF 100%)';
		const style = getSlideBackgroundStyle(
			slide({ backgroundGradient: gradient, backgroundShadeToTitle: true, elements: [] }),
		);
		expect(style['background-image']).toBe(gradient);
	});
});
