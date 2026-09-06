import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ImageBox from './ImageBox.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ImageBox, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
	});
	flushSync();
	return target;
}

describe('imageBox reflection (regression: ShapeEffectOverlay was never mounted here)', () => {
	it('mirrors a reflected picture', () => {
		// `ElementRenderer` only ever mounted `ShapeEffectOverlay` on its
		// text/shape branch; a picture routed through this component instead
		// and never got one, so `a:effectLst/a:reflection` on a picture
		// rendered nothing at all despite `ShapeEffectOverlay` itself
		// supporting pictures.
		const target = render({
			type: 'picture',
			id: 'pic-refl',
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			imageData: 'data:image/png;base64,AAAA',
			shapeStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
		} as unknown as PptxElement);
		const img = target.querySelector<HTMLImageElement>('.pptx-svelte-reflection img');
		expect(img?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
	});

	it('renders nothing extra for a picture with no reflection', () => {
		const target = render({
			type: 'picture',
			id: 'pic-plain',
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			imageData: 'data:image/png;base64,AAAA',
		} as unknown as PptxElement);
		expect(target.querySelector('.pptx-svelte-reflection')).toBeNull();
	});
});
