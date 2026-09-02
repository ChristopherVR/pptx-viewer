/**
 * The two picture-rendering rules Svelte was missing against React.
 *
 * Svelte resolved only the raster blip and hard-coded `object-fit: contain`, so
 * on a real deck an SVG-only icon rendered as an empty box and an inset cropped
 * out of a wide composite image showed the whole composite instead of its own
 * region. Both rules now come from `pptx-viewer-shared`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { getCropShapeClipPath } from 'pptx-viewer-shared';
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

	it('applies a "Crop to Shape" clip-path on the stationary container (issue: wave 4 #7)', () => {
		const target = mountBox({
			type: 'picture',
			id: 'pic-crop-shape',
			x: 0,
			y: 0,
			width: 100,
			height: 60,
			imageData: 'data:image/png;base64,AA==',
			cropShape: 'ellipse',
		} as unknown as PptxElement);

		const box = target.querySelector('.pptx-svelte-image') as HTMLElement;
		expect(box.style.clipPath).toBe(getCropShapeClipPath('ellipse', 100, 60));
		expect(box.style.clipPath.length).toBeGreaterThan(0);
	});

	it('writes no clip-path when the picture has no crop shape', () => {
		const target = mountBox({
			type: 'picture',
			id: 'pic-no-crop-shape',
			x: 0,
			y: 0,
			width: 100,
			height: 60,
			imageData: 'data:image/png;base64,AA==',
		} as unknown as PptxElement);

		const box = target.querySelector('.pptx-svelte-image') as HTMLElement;
		expect(box.style.clipPath).toBe('');
	});

	it('applies a14 Corrections/Color panel filters and the sharpen SVG filter def (issue: wave 4 #8)', () => {
		const target = mountBox({
			type: 'picture',
			id: 'pic-a14-corrections',
			x: 0,
			y: 0,
			width: 100,
			height: 60,
			imageData: 'data:image/png;base64,AA==',
			imageEffects: {
				brightnessContrast: { bright: -20000, contrast: 10000 },
				colorSaturation: { sat: 50000 },
				sharpenSoften: { amount: 50000 },
			},
		} as unknown as PptxElement);

		const img = target.querySelector('img') as HTMLImageElement;
		expect(img.style.filter).toContain('brightness(');
		expect(img.style.filter).toContain('contrast(');
		expect(img.style.filter).toContain('saturate(0.5)');
		expect(img.style.filter).toContain(`url(#sharpen-pic-a14-corrections)`);
		const sharpenFilter = target.querySelector('filter#sharpen-pic-a14-corrections');
		expect(sharpenFilter).not.toBeNull();
		expect(sharpenFilter?.querySelector('feConvolveMatrix')).not.toBeNull();
	});

	it('clips a custGeom oval-cut picture on the FRAME, not the img', () => {
		// Regression: the picture's own shape geometry (an authored oval
		// custGeom) must clip the stationary frame. A pixel-space clip on the
		// `<img>` would be scaled and shifted by the source-crop transform, and
		// the oval rendered past its frame.
		const target = mountBox({
			type: 'picture',
			id: 'pic-oval',
			x: 0,
			y: 0,
			width: 756,
			height: 427,
			imageData: 'data:image/png;base64,AA==',
			shapeType: 'custom',
			pathData: 'M 0 0 L 100 0 L 100 100 Z',
			pathWidth: 100,
			pathHeight: 100,
		} as unknown as PptxElement);

		const box = target.querySelector('.pptx-svelte-image') as HTMLElement;
		const img = target.querySelector('img') as HTMLImageElement;
		expect(box.style.clipPath.startsWith('path(')).toBeTruthy();
		expect(img.style.clipPath).toBe('');
	});
});
