import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ZoomNavigationContextKey } from '../state/zoom-navigation-context';
import ElementRenderer from './ElementRenderer.svelte';

/**
 * ZoomView tests: preview thumbnail vs fallback tile, the slide/section
 * badge, and aria-label / data-attribute wiring, mirroring the vanilla zoom
 * renderer tests.
 */

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let cleanup: (() => void) | undefined;

function mountEl(
	element: PptxElement,
	options: { presenting?: boolean; navigation?: (index: number) => void } = {},
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: {
			element,
			mediaDataUrls: new Map<string, string>(),
			zIndex: 4,
			presenting: options.presenting,
		},
		context: options.navigation
			? new Map([
					[
						ZoomNavigationContextKey,
						{
							navigateToZoomTarget: options.navigation,
							getSlides: () => [
								{},
								{},
								{},
								{},
								{},
								{
									slideNumber: 12,
									backgroundColor: '#123456',
									sectionName: 'Quarterly results',
									elements: [],
								},
							],
						},
					],
				])
			: undefined,
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

	it('uses target metadata and navigates by click or keyboard while presenting', () => {
		const navigate = vi.fn<(index: number) => void>();
		const target = mountEl(zoomElement({ zoomType: 'section', targetSectionId: 'sec-1' }), {
			presenting: true,
			navigation: navigate,
		});
		const node = target.querySelector<HTMLElement>('[data-element-id="zm-1"]');
		expect(node?.getAttribute('role')).toBe('button');
		expect(node?.getAttribute('tabindex')).toBe('0');
		expect(target.querySelector('.pptx-svelte-zoom-slide-label')?.textContent).toBe('Slide 12');
		expect(target.querySelector('.pptx-svelte-zoom-section-label')?.textContent).toBe(
			'Quarterly results',
		);
		expect(
			target.querySelector<HTMLElement>('.pptx-svelte-zoom-thumbnail')?.getAttribute('style'),
		).toContain('#123456');

		node?.click();
		node?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(navigate).toHaveBeenNthCalledWith(1, 5);
		expect(navigate).toHaveBeenNthCalledWith(2, 5);
	});

	it('renders ordered Summary Zoom tiles and navigates the selected section', () => {
		const navigate = vi.fn<(index: number) => void>();
		const target = mountEl(
			zoomElement({
				zoomType: 'summary',
				summaryLayout: 'grid',
				summaryTargets: [
					{
						sectionId: 'intro',
						targetSlideIndex: 1,
						x: 300,
						y: 200,
						width: 90,
						height: 120,
						title: 'Intro',
					},
					{
						sectionId: 'details',
						targetSlideIndex: 5,
						x: 410,
						y: 200,
						width: 90,
						height: 120,
						title: 'Details',
					},
				],
			}),
			{ presenting: true, navigation: navigate },
		);
		const node = target.querySelector<HTMLElement>('[data-element-id="zm-1"]');
		const tiles = target.querySelectorAll<HTMLElement>('.pptx-svelte-summary-zoom-tile');
		expect(node?.dataset.zoomType).toBe('summary');
		expect(node?.textContent).toContain('Summary Zoom');
		expect([...tiles].map((tile) => tile.dataset.sectionId)).toStrictEqual(['intro', 'details']);
		tiles[1].click();
		expect(navigate).toHaveBeenCalledWith(5);
	});
});
