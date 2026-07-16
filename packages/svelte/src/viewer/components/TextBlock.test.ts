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
		...overrides,
	};
}

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
