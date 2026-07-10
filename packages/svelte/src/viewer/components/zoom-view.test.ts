import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * ZoomView tests: preview thumbnail vs fallback tile, the slide/section
 * badge, and aria-label / data-attribute wiring, mirroring the vanilla zoom
 * renderer tests.
 */

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 4 },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function zoomElement(overrides: Record<string, unknown>): PptxElement {
	return {
		type: 'zoom',
		id: 'zm-1',
		x: 300,
		y: 200,
		width: 200,
		height: 120,
		zoomType: 'slide',
		targetSlideIndex: 5,
		...overrides,
	} as PptxElement;
}

describe('zoomView', () => {
	it('renders the preview thumbnail with a Slide Zoom badge', () => {
		const target = mountEl(zoomElement({ imageData: PNG_DATA_URL }));
		const node = target.querySelector<HTMLElement>('[data-element-id="zm-1"]');
		expect(node?.dataset.zoomType).toBe('slide');
		expect(node?.dataset.zoomTarget).toBe('5');
		expect(node?.getAttribute('style')).toContain('left: 300px');
		expect(node?.getAttribute('style')).toContain('z-index: 4');
		expect(node?.getAttribute('aria-label')).toBe('Zoom to slide 6');

		const img = node?.querySelector<HTMLImageElement>('img.pptx-svelte-zoom-img');
		expect(img?.getAttribute('src')).toBe(PNG_DATA_URL);
		expect(img?.alt).toBe('Preview of slide 6');
		expect(node?.querySelector('.pptx-svelte-zoom-thumbnail')).toBeNull();
		expect(node?.querySelector('.pptx-svelte-zoom-badge')?.textContent).toBe('Slide Zoom');
	});

	it('renders the fallback tile with the target slide number when no preview exists', () => {
		const target = mountEl(zoomElement({}));
		expect(target.querySelector('img')).toBeNull();
		const tile = target.querySelector<HTMLElement>('.pptx-svelte-zoom-thumbnail');
		expect(tile).toBeTruthy();
		expect(tile?.querySelector('.pptx-svelte-zoom-slide-label')?.textContent).toBe('Slide 6');
		expect(tile?.querySelector('.pptx-svelte-zoom-section-label')).toBeNull();
	});

	it('renders section zooms with the section id and a Section Zoom badge', () => {
		const target = mountEl(zoomElement({ zoomType: 'section', targetSectionId: '{ABC-123}' }));
		const node = target.querySelector<HTMLElement>('[data-element-id="zm-1"]');
		expect(node?.dataset.zoomType).toBe('section');
		expect(node?.getAttribute('aria-label')).toBe('Zoom to slide 6 (section: {ABC-123})');
		expect(target.querySelector('.pptx-svelte-zoom-section-label')?.textContent).toBe('{ABC-123}');
		expect(target.querySelector('.pptx-svelte-zoom-badge')?.textContent).toBe('Section Zoom');
	});
});
