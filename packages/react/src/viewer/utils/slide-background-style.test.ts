import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getReactSlideBackgroundStyle } from './slide-background-style';

describe('getReactSlideBackgroundStyle', () => {
	it('adapts shared background properties to React camel-case keys', () => {
		const style = getReactSlideBackgroundStyle({
			id: 'slide-1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [],
			backgroundColor: '#123456',
			backgroundImage: 'data:image/png;base64,abc',
		});

		expect(style).toStrictEqual({
			backgroundColor: '#123456',
			backgroundImage: undefined,
			backgroundSize: '100% 100%',
			backgroundRepeat: 'no-repeat',
		});
	});

	it('anchors a shadeToTitle gradient on the title placeholder when a slide size is supplied', () => {
		const style = getReactSlideBackgroundStyle(
			{
				id: 'slide-1',
				rId: 'rId1',
				slideNumber: 1,
				backgroundGradient: 'linear-gradient(90.00deg, #000000 0%, #ffffff 100%)',
				backgroundShadeToTitle: true,
				elements: [
					{
						id: 'title1',
						type: 'text',
						x: 0,
						y: 0,
						width: 100,
						height: 50,
						placeholderType: 'title',
					} as unknown as PptxElement,
				],
			},
			{ widthPx: 960, heightPx: 540 },
		);

		expect(style.backgroundImage).not.toBe('linear-gradient(90.00deg, #000000 0%, #ffffff 100%)');
		expect(style.backgroundImage).toMatch(/^url\("data:image\/svg\+xml,/u);
	});
});
