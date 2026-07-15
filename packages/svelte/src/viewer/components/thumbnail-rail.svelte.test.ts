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
});
