import type { PptxSlide } from 'pptx-viewer-core';
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
});
