import type { RenderParagraph } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { renderTextBlock } from './text-block';

function paragraph(overrides: Partial<RenderParagraph>): RenderParagraph {
	return {
		runs: [{ text: 'Picture item', style: {} }],
		bulletStyle: {},
		segmentIndices: [],
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

	it('renders a hyperlink run as a safe anchor', () => {
		// Before `ParagraphRun` carried a hyperlink, this binding painted linked
		// text as an ordinary span: the link was silently gone from the DOM.
		const block = renderTextBlock(
			document,
			[
				paragraph({
					runs: [
						{ text: 'Home', style: {} },
						{
							text: ' docs',
							style: {},
							hyperlink: {
								url: 'https://example.com',
								href: 'https://example.com',
								tooltip: 'Docs',
							},
						},
					],
				}),
			],
			{},
		);
		const link = block.querySelector<HTMLAnchorElement>('a.pptxv-link');
		expect(link?.getAttribute('href')).toBe('https://example.com');
		expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
		expect(link?.getAttribute('title')).toBe('Docs');
		expect(link?.textContent).toBe(' docs');
		// The neighbouring plain run stays a span.
		expect(block.querySelectorAll('a')).toHaveLength(1);
	});

	it('renders an inline equation run as MathML in its authored position', () => {
		const block = renderTextBlock(
			document,
			[
				paragraph({
					runs: [
						{ text: 'Given ', style: {} },
						{
							text: '',
							style: {},
							equation: { xml: { 'm:oMath': { 'm:r': { 'm:t': 'x' } } }, number: '1' },
						},
						{ text: ' holds', style: {} },
					],
				}),
			],
			{},
		);
		const math = block.querySelector('.pptxv-inline-equation .pptxv-equation-math');
		expect(math?.innerHTML).toContain('<mi>x</mi>');
		expect(block.querySelector('.pptxv-equation-number')?.textContent).toBe('(1)');
		// In place: the prose on either side survives, which the wholesale
		// "delegate the whole element to the equation renderer" path destroyed.
		expect(block.textContent).toContain('Given ');
		expect(block.textContent).toContain(' holds');
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

// `a:ruby` reached React alone: shared's `ParagraphRun` did not model the
// annotation, so `buildParagraphs` never carried it and the phonetic guide
// vanished here (the base text still painted, which is why nothing looked
// broken).
describe('renderTextBlock ruby annotations', () => {
	it('renders the phonetic guide above its base text', () => {
		const block = renderTextBlock(
			document,
			[
				paragraph({
					runs: [
						{
							text: '漢字',
							style: {},
							ruby: { text: 'かんじ', style: { fontSize: '10px', textAlign: 'center' } },
						},
					],
				}),
			],
			{},
		);
		const ruby = block.querySelector('ruby');
		expect(ruby?.querySelector('rt')?.textContent).toBe('かんじ');
		expect(ruby?.querySelector('rt')?.style.fontSize).toBe('10px');
		// The `<rp>` parentheses are what a browser without ruby support shows.
		expect(block.querySelectorAll('rp')).toHaveLength(2);
		expect(ruby?.textContent).toContain('漢字');
	});

	it('leaves an ordinary run as a plain span', () => {
		const block = renderTextBlock(document, [paragraph({})], {});
		expect(block.querySelector('ruby')).toBeNull();
	});
});
