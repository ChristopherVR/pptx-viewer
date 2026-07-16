import type { PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ThumbnailRail from './ThumbnailRail.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function slides(): PptxSlide[] {
	return ['one', 'two', 'three'].map((id, index) => ({
		id,
		rId: `rId-${id}`,
		slideNumber: index + 1,
		elements: [],
	}));
}

function manySlides(count: number): PptxSlide[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `slide-${index}`,
		rId: `rId-${index}`,
		slideNumber: index + 1,
		elements: [],
	}));
}

describe('thumbnailRail', () => {
	it('exposes the canonical Slides navigation name', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ThumbnailRail, {
			target,
			props: {
				slides: slides(),
				canvasSize: { width: 960, height: 540 },
				mediaDataUrls: new Map(),
				current: 0,
				onselect: vi.fn(),
			},
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		expect(target.querySelector('nav')?.getAttribute('aria-label')).toBe('Slides');
	});

	it('only marks thumbnails draggable when editing is enabled', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ThumbnailRail, {
			target,
			props: {
				slides: slides(),
				canvasSize: { width: 960, height: 540 },
				mediaDataUrls: new Map(),
				current: 0,
				onselect: vi.fn(),
				editable: true,
			},
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		expect(target.querySelector('.pptx-svelte-thumb')?.getAttribute('draggable')).toBe('true');
	});

	it('forwards an ordered drag/drop pair to the slide move callback', () => {
		const onmove = vi.fn();
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ThumbnailRail, {
			target,
			props: {
				slides: slides(),
				canvasSize: { width: 960, height: 540 },
				mediaDataUrls: new Map(),
				current: 0,
				onselect: vi.fn(),
				editable: true,
				onmove,
			},
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		const thumbs = Array.from(target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-thumb'));
		thumbs[0].dispatchEvent(new Event('dragstart', { bubbles: true }));
		const drop = new Event('drop', { bubbles: true, cancelable: true });
		thumbs[2].dispatchEvent(drop);
		expect(drop.defaultPrevented).toBeTruthy();
		expect(onmove).toHaveBeenCalledWith(0, 2);
	});

	it('virtualizes thumbnail rows at the React large-deck threshold', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ThumbnailRail, {
			target,
			props: {
				slides: manySlides(100),
				canvasSize: { width: 960, height: 540 },
				mediaDataUrls: new Map(),
				current: 0,
				onselect: vi.fn(),
			},
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		expect(target.querySelector('[data-virtualized="true"]')).toBeTruthy();
		expect(target.querySelectorAll('.pptx-svelte-thumb').length).toBeLessThan(30);
	});

	it('renders section headers and forwards section actions', () => {
		const deck = slides();
		deck[0] = { ...deck[0], sectionId: 'intro', sectionName: 'Introduction' };
		deck[1] = { ...deck[1], sectionId: 'body', sectionName: 'Body' };
		const onsectiontoggle = vi.fn();
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ThumbnailRail, {
			target,
			props: {
				slides: deck,
				sections: [
					{ id: 'intro', name: 'Introduction', slideIds: ['1'] },
					{ id: 'body', name: 'Body', slideIds: ['2'] },
				],
				canvasSize: { width: 960, height: 540 },
				mediaDataUrls: new Map(),
				current: 0,
				onselect: vi.fn(),
				onsectiontoggle,
			},
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		expect(
			Array.from(target.querySelectorAll('.pptx-svelte-section-header strong')).map(
				(el) => el.textContent,
			),
		).toStrictEqual(['Introduction', 'Body', 'Ungrouped Slides']);
		target.querySelector<HTMLButtonElement>('.pptx-svelte-section-toggle')?.click();
		expect(onsectiontoggle).toHaveBeenCalledWith('intro');
	});
});
