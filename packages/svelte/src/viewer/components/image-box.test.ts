import type { ImagePptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import ImageBox from './ImageBox.svelte';

const resolveSource = vi.fn(async () => 'data:image/png;base64,processed');
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal<typeof import('pptx-viewer-shared')>()),
	resolveColorChangedImageSource: (...args: unknown[]) => resolveSource(...args),
}));

describe('image box source effects', () => {
	it('applies clrChange and renders the shared color wash style', async () => {
		const target = document.createElement('div');
		const element: ImagePptxElement = {
			type: 'image',
			id: 'image-1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,source',
			imageEffects: {
				clrChange: { clrFrom: '#00FF00', clrTo: '#FF0000' },
				colorWash: { color: '#112233', opacity: 35 },
			},
		};
		const instance = mount(ImageBox, {
			target,
			props: { element, mediaDataUrls: new Map(), zIndex: 0 },
		});
		try {
			flushSync();
			await Promise.resolve();
			flushSync();
			expect(resolveSource).toHaveBeenCalledOnce();
			expect((target.querySelector('img') as HTMLImageElement).src).toContain('processed');
			const wash = target.querySelector('.pptx-svelte-image-color-wash') as HTMLElement;
			expect(wash.style.backgroundColor).toBe('#112233');
			expect(wash.style.opacity).toBe('0.35');
		} finally {
			unmount(instance);
		}
	});
});
