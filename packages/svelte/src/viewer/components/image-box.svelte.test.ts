/**
 * The two picture-rendering rules Svelte was missing against React.
 *
 * Svelte resolved only the raster blip and hard-coded `object-fit: contain`, so
 * on a real deck an SVG-only icon rendered as an empty box and an inset cropped
 * out of a wide composite image showed the whole composite instead of its own
 * region. Both rules now come from `pptx-viewer-shared`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ImageBox from './ImageBox.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountBox(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ImageBox, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('image box', () => {
	it('renders a picture whose only blip is an SVG extension', () => {
		const target = mountBox({
			type: 'picture',
			id: 'pic-svg',
			x: 0,
			y: 0,
			width: 40,
			height: 40,
			svgData: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
		} as unknown as PptxElement);

		const img = target.querySelector('img');
		expect(img?.getAttribute('src')).toBe('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');
	});

	it('applies the authored source crop rather than fitting the whole bitmap', () => {
		const target = mountBox({
			type: 'picture',
			id: 'pic-crop',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,AA==',
			cropLeft: 0.25,
			cropRight: 0.25,
		} as unknown as PptxElement);

		const img = target.querySelector('img') as HTMLImageElement;
		expect(img.style.objectFit).toBe('fill');
		expect(img.style.transform).toBe('translate(-50%, 0%) scale(2, 1)');
		// The scaled-up source must not paint outside its own frame.
		const box = target.querySelector('.pptx-svelte-image') as HTMLElement;
		expect(box.style.overflow).toBe('hidden');
	});
});
