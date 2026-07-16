import type { RenderParagraph } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { renderTextBlock } from './text-block';

function paragraph(overrides: Partial<RenderParagraph>): RenderParagraph {
	return {
		runs: [{ text: 'Picture item', style: {} }],
		bulletStyle: {},
		...overrides,
	};
}

describe('renderTextBlock picture bullets', () => {
	it('renders the resolved image with accessible sizing metadata', () => {
		const block = renderTextBlock(
			document,
			[
				paragraph({
					bulletPicture: {
						src: 'data:image/png;base64,iVBOR',
						sizePx: 24,
						fallbackMarker: '•',
						accessibleLabel: 'Bullet',
					},
				}),
			],
			{},
		);
		const image = block.querySelector<HTMLImageElement>('.pptxv-bullet-image');
		expect(image?.src).toBe('data:image/png;base64,iVBOR');
		expect(image?.alt).toBe('Bullet');
		expect(image?.style.width).toBe('24px');
		expect(image?.style.height).toBe('24px');
	});

	it('labels the glyph fallback when the image is unresolved', () => {
		const block = renderTextBlock(
			document,
			[
				paragraph({
					bulletMarker: '•',
					bulletPicture: {
						sizePx: 16,
						fallbackMarker: '•',
						accessibleLabel: 'Bullet',
						imageRelId: 'rId5',
					},
				}),
			],
			{},
		);
		const fallback = block.querySelector('.pptxv-bullet');
		expect(block.querySelector('.pptxv-bullet-image')).toBeNull();
		expect(fallback?.textContent).toContain('•');
		expect(fallback?.getAttribute('aria-label')).toBe('Bullet');
	});
});
