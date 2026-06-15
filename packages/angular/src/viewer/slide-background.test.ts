import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SLIDE_BACKGROUND, getSlideBackgroundStyle } from './slide-background';

/** Minimal slide factory; only background fields are read by the helper. */
function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 's1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		...overrides,
	} as PptxSlide;
}

describe('getSlideBackgroundStyle', () => {
	it('defaults to white when no background is set', () => {
		const style = getSlideBackgroundStyle(slide());
		expect(style['background-color']).toBe(DEFAULT_SLIDE_BACKGROUND);
		expect(style['background-image']).toBeUndefined();
	});

	it('defaults to white for an undefined slide', () => {
		expect(getSlideBackgroundStyle(undefined)['background-color']).toBe(DEFAULT_SLIDE_BACKGROUND);
	});

	it('uses a solid background colour', () => {
		const style = getSlideBackgroundStyle(slide({ backgroundColor: '#112233' }));
		expect(style['background-color']).toBe('#112233');
	});

	it('treats "transparent" as no solid colour (falls back to white)', () => {
		const style = getSlideBackgroundStyle(slide({ backgroundColor: 'transparent' }));
		expect(style['background-color']).toBe(DEFAULT_SLIDE_BACKGROUND);
	});

	it('applies a gradient as a background-image', () => {
		const gradient = 'linear-gradient(90deg, #fff 0%, #000 100%)';
		const style = getSlideBackgroundStyle(slide({ backgroundGradient: gradient }));
		expect(style['background-image']).toBe(gradient);
	});

	it('applies an image fill and stretches it to cover', () => {
		const style = getSlideBackgroundStyle(slide({ backgroundImage: 'data:image/png;base64,AAA' }));
		expect(style['background-image']).toBe('url(data:image/png;base64,AAA)');
		expect(style['background-size']).toBe('100% 100%');
		expect(style['background-repeat']).toBe('no-repeat');
	});

	it('prefers the image fill over a gradient when both are present', () => {
		const style = getSlideBackgroundStyle(
			slide({
				backgroundImage: 'data:image/png;base64,AAA',
				backgroundGradient: 'linear-gradient(90deg, #fff, #000)',
			}),
		);
		expect(style['background-image']).toBe('url(data:image/png;base64,AAA)');
	});

	it('uses the pattern background colour as the flat base', () => {
		const style = getSlideBackgroundStyle(
			slide({
				// Parser leaves backgroundColor as the pattern foreground colour.
				backgroundColor: '#ff0000',
				backgroundPattern: { preset: 'pct10', fgColor: '#ff0000', bgColor: '#00ff00' },
			}),
		);
		expect(style['background-color']).toBe('#00ff00');
	});
});
