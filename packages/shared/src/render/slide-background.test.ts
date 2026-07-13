import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getSlideBackgroundStyle } from './slide-background';

function slide(overrides: Partial<PptxSlide>): PptxSlide {
	return { id: 'slide1', rId: 'rId1', slideNumber: 1, elements: [], ...overrides };
}

describe('getSlideBackgroundStyle', () => {
	it('uses a pattern background colour instead of the foreground colour', () => {
		const style = getSlideBackgroundStyle(
			slide({
				backgroundColor: '#FF0000',
				backgroundPattern: { preset: 'pct10', fgColor: '#FF0000', bgColor: '#00FF00' },
			}),
		);

		expect(style['background-color']).toBe('#00FF00');
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
});
