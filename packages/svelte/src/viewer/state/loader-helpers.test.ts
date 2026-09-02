import type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveLazyImages } from './loader-helpers';

/** Minimal `PptxHandler` stub: only `getImageData` is exercised here. */
function handlerResolvingTo(urls: Record<string, string>): PptxHandler {
	return {
		getImageData: (path: string) => Promise.resolve(urls[path]),
	} as unknown as PptxHandler;
}

function imageElement(id: string, imagePath: string): PptxElement {
	return { id, type: 'image', imagePath } as unknown as PptxElement;
}

function groupElement(id: string, children: PptxElement[]): PptxElement {
	return { id, type: 'group', children } as unknown as PptxElement;
}

describe('resolveLazyImages (shared applyImagePathPatches repoint)', () => {
	it('patches a top-level image and a nested group child, recursing via the shared walker', async () => {
		const handler = handlerResolvingTo({
			'media/image1.png': 'data:image/png;base64,AAA',
			'media/image2.png': 'data:image/png;base64,BBB',
		});
		const slide: PptxSlide = {
			id: 's1',
			elements: [
				imageElement('top', 'media/image1.png'),
				groupElement('grp', [imageElement('nested', 'media/image2.png')]),
			],
		} as unknown as PptxSlide;

		const [resolved] = await resolveLazyImages(handler, [slide]);

		const top = resolved.elements.find((el) => el.id === 'top') as unknown as {
			imageData?: string;
		};
		expect(top.imageData).toBe('data:image/png;base64,AAA');

		const group = resolved.elements.find((el) => el.id === 'grp') as unknown as {
			children: { id: string; imageData?: string }[];
		};
		expect(group.children[0].imageData).toBe('data:image/png;base64,BBB');
	});

	it('returns the same slide array reference when there is nothing to resolve', async () => {
		const handler = handlerResolvingTo({});
		const slide: PptxSlide = {
			id: 's1',
			elements: [{ id: 'shape-1', type: 'shape' } as unknown as PptxElement],
		} as unknown as PptxSlide;
		const slides = [slide];

		const resolved = await resolveLazyImages(handler, slides);

		expect(resolved).toBe(slides);
	});
});
