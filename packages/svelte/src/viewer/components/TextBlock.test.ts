import type { RenderParagraph } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import TextBlock from './TextBlock.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(renderParagraph: RenderParagraph): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(TextBlock, {
		target,
		props: { paragraphs: [renderParagraph], textStyle: '' },
	});
	flushSync();
	return target;
}

function paragraph(overrides: Partial<RenderParagraph>): RenderParagraph {
	return {
		runs: [{ text: 'Picture item', style: {} }],
		bulletStyle: {},
		segmentIndices: [],
		...overrides,
	};
}

// `a:ruby` reached React alone: shared's `ParagraphRun` did not model the
// annotation, so `buildParagraphs` never carried it and the phonetic guide
// vanished here (the base text still painted, which is why nothing looked
// broken).
describe('textBlock ruby annotations', () => {
	it('renders the phonetic guide above its base text', () => {
		const target = render(
			paragraph({
				runs: [
					{
						text: '漢字',
						style: {},
						ruby: { text: 'かんじ', style: { fontSize: '10px', textAlign: 'center' } },
					},
				],
			}),
		);
		const ruby = target.querySelector('ruby');
		expect(ruby?.querySelector('rt')?.textContent).toBe('かんじ');
		expect(ruby?.querySelector('rt')?.getAttribute('style')).toContain('font-size: 10px');
		// The `<rp>` parentheses are what a browser without ruby support shows.
		expect(target.querySelectorAll('rp')).toHaveLength(2);
		expect(ruby?.textContent).toContain('漢字');
	});

	it('leaves an ordinary run as a plain span', () => {
		expect(render(paragraph({})).querySelector('ruby')).toBeNull();
	});
});

describe('textBlock picture bullets', () => {
	it('renders the resolved image with accessible sizing metadata', () => {
		const target = render(
			paragraph({
				bulletPicture: {
					src: 'data:image/png;base64,iVBOR',
					sizePx: 24,
					fallbackMarker: '•',
					accessibleLabel: 'Bullet',
				},
			}),
		);
		const image = target.querySelector<HTMLImageElement>('.pptx-svelte-bullet-image');
		expect(image?.src).toBe('data:image/png;base64,iVBOR');
		expect(image?.alt).toBe('Bullet');
		expect(image?.style.width).toBe('24px');
		expect(image?.style.height).toBe('24px');
	});

	it('applies per-paragraph line-height and space before/after', () => {
		const target = render(
			paragraph({
				marginLeftPx: 12,
				spaceBeforePx: 8,
				spaceAfterPx: 6,
				lineHeight: 1.5,
				textIndentPx: 4,
			}),
		);
		const p = target.querySelector<HTMLElement>('.pptx-svelte-para');
		expect(p?.style.marginLeft).toBe('12px');
		expect(p?.style.marginTop).toBe('8px');
		expect(p?.style.marginBottom).toBe('6px');
		expect(p?.style.lineHeight).toBe('1.5');
		expect(p?.style.textIndent).toBe('4px');
	});

	it('supports exact "<n>pt" line-height and keeps the 0 spacing default', () => {
		const target = render(paragraph({ lineHeight: '18pt' }));
		const p = target.querySelector<HTMLElement>('.pptx-svelte-para');
		expect(p?.style.lineHeight).toBe('18pt');
		// Unset space-before/after keep the shorthand's 0 default (no regression
		// from the previous `margin: 0 0 0 <left>` behaviour).
		expect(p?.style.marginTop).toBe('0px');
		expect(p?.style.marginBottom).toBe('0px');
	});

	it('labels the glyph fallback when the image is unresolved', () => {
		const target = render(
			paragraph({
				bulletMarker: '•',
				bulletPicture: {
					sizePx: 16,
					fallbackMarker: '•',
					accessibleLabel: 'Bullet',
					imageRelId: 'rId5',
				},
			}),
		);
		const fallback = target.querySelector('.pptx-svelte-bullet');
		expect(target.querySelector('.pptx-svelte-bullet-image')).toBeNull();
		expect(fallback?.textContent).toContain('•');
		expect(fallback?.getAttribute('aria-label')).toBe('Bullet');
	});
});

describe('textBlock hyperlink and inline equation runs', () => {
	it('renders a hyperlinked run as a safe anchor', () => {
		// Before `ParagraphRun` carried a hyperlink, this binding painted linked
		// text as an ordinary span: the link was silently gone from the DOM.
		const target = render(
			paragraph({
				runs: [
					{ text: 'See ', style: {} },
					{
						text: 'the docs',
						style: {},
						hyperlink: { url: 'https://example.com', href: 'https://example.com', tooltip: 'Docs' },
					},
				],
			}),
		);
		const link = target.querySelector<HTMLAnchorElement>('a.pptx-svelte-link');
		expect(link?.getAttribute('href')).toBe('https://example.com');
		expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
		expect(link?.getAttribute('title')).toBe('Docs');
		expect(link?.textContent).toBe('the docs');
		expect(target.querySelectorAll('a')).toHaveLength(1);
	});

	it('renders an inline equation run as MathML between the runs around it', () => {
		const target = render(
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
		);
		expect(
			target.querySelector('.pptx-svelte-inline-equation .pptx-svelte-equation')?.innerHTML,
		).toContain('<mi>x</mi>');
		expect(target.querySelector('.pptx-svelte-equation-number')?.textContent).toBe('(1)');
		// The prose on either side survives, which the wholesale "delegate the
		// whole element to EquationView" path destroyed.
		expect(target.textContent).toContain('Given');
		expect(target.textContent).toContain('holds');
	});
});
