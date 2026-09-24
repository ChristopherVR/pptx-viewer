import type { PptxElement } from 'pptx-viewer-core';
import { _resetNativeImageSizeCacheForTests } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('imageBox rotWithShape=false counter-transform (issue: flipped picture fill)', () => {
	it('counter-flips the img when a blipFill disables rotWithShape', () => {
		// Regression: a custGeom trapezoid with flipV="1" whose blipFill carries
		// `rotWithShape="0"` used to render its photo upside down, because only
		// the container's transform flipped the whole picture. The `<img>` must
		// carry the exact inverse transform so the bitmap stays upright while
		// the container's clip-path (the shape's own geometry) still flips.
		const target = render({
			type: 'picture',
			id: 'pic-rotwithshape',
			x: 0,
			y: 0,
			width: 100,
			height: 60,
			flipVertical: true,
			shapeType: 'custom',
			imageData: 'data:image/png;base64,AAAA',
			shapeStyle: { fillMode: 'image', fillImageRotWithShape: false },
		} as unknown as PptxElement);
		const img = target.querySelector<HTMLImageElement>('img');
		expect(img?.style.transform).toBe('scaleY(-1)');
		const container = target.querySelector<HTMLElement>('.pptx-svelte-image');
		expect(container?.style.transform).toContain('scaleY(-1)');
	});

	it('does not counter-flip the img when rotWithShape is unset (default true)', () => {
		const target = render({
			type: 'picture',
			id: 'pic-rotwithshape-default',
			x: 0,
			y: 0,
			width: 100,
			height: 60,
			flipVertical: true,
			imageData: 'data:image/png;base64,AAAA',
			shapeStyle: { fillMode: 'image' },
		} as unknown as PptxElement);
		const img = target.querySelector<HTMLImageElement>('img');
		expect(img?.style.transform).not.toContain('scaleY(-1)');
	});
});

/**
 * `a:tile/@sx`/`@sy` (ECMA-376 §20.1.8.58) is a percentage of the picture's
 * own NATIVE pixel size, not of the container. `ImageBox` probes the native
 * size asynchronously (`pptx-viewer-shared`'s `image-native-size`) and
 * re-derives the tile's `backgroundSize` in absolute pixels once it resolves.
 */
describe('imageBox tiled-picture native size', () => {
	const SRC = 'data:image/png;base64,tile-src';

	/** A minimal `Image`-like stub whose `onload` fires on the next microtask. */
	class FakeImage {
		naturalWidth = 800;
		naturalHeight = 400;
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		#src = '';
		get src(): string {
			return this.#src;
		}
		set src(value: string) {
			this.#src = value;
			queueMicrotask(() => this.onload?.());
		}
	}

	beforeEach(() => {
		_resetNativeImageSizeCacheForTests();
		vi.stubGlobal('Image', FakeImage);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function tiledElement(): PptxElement {
		return {
			type: 'picture',
			id: 'pic-tiled',
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			tileScaleX: 0.1,
			tileScaleY: 0.25,
			imageData: SRC,
		} as unknown as PptxElement;
	}

	it('renders the container-relative percentage before the native size resolves', () => {
		const target = render(tiledElement());
		const tile = target.querySelector<HTMLElement>('.pptx-svelte-image-tile');
		expect(tile?.style.backgroundSize).toBe('10% 25%');
	});

	it('switches to an absolute-pixel backgroundSize once the native size resolves', async () => {
		const target = render(tiledElement());
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});
		flushSync();
		const tile = target.querySelector<HTMLElement>('.pptx-svelte-image-tile');
		// 800 * 0.1 = 80, 400 * 0.25 = 100.
		expect(tile?.style.backgroundSize).toBe('80px 100px');
	});
});
