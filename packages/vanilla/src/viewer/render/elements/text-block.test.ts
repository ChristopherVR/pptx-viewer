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

	it('applies per-paragraph line-height and space before/after', () => {
		const block = renderTextBlock(
			document,
			[paragraph({ lineHeight: 1.5, spaceBeforePx: 12, spaceAfterPx: 6 })],
			{},
		);
		const p = block.querySelector<HTMLParagraphElement>('.pptxv-para');
		expect(p?.style.lineHeight).toBe('1.5');
		expect(p?.style.marginTop).toBe('12px');
		expect(p?.style.marginBottom).toBe('6px');
	});

	it('supports an exact "<n>pt" line-height and omits unset spacing', () => {
		const block = renderTextBlock(document, [paragraph({ lineHeight: '18pt' })], {});
		const p = block.querySelector<HTMLParagraphElement>('.pptxv-para');
		expect(p?.style.lineHeight).toBe('18pt');
		// Unset space-before/after leave the base `margin: 0` shorthand (0px).
		expect(p?.style.marginTop).toBe('0px');
		expect(p?.style.marginBottom).toBe('0px');
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
