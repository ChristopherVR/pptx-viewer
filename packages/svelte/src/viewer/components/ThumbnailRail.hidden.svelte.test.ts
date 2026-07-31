/**
 * The hidden-slide cue in the Svelte thumbnail rail and slide sorter.
 *
 * Both surfaces deliberately keep LISTING a hidden slide (hiding only removes
 * it from the show), and until this neither gave any indication that the slide
 * would be skipped. These assert the three shared signals: the neutral marker
 * attribute, the slash across the number (a shape, because colour alone is not
 * an accessible signal), and a description that reaches assistive tech without
 * disturbing the "Go to slide {{n}}" accessible name the e2e suite pins.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { HIDDEN_SLIDE_SLASH_GRADIENT } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import SlideSorterOverlay from './SlideSorterOverlay.svelte';
import ThumbnailRail from './ThumbnailRail.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const CANVAS = { width: 960, height: 540 };

function deck(hidden: readonly number[]): PptxSlide[] {
	return Array.from(
		{ length: 3 },
		(_unused, index) =>
			({
				id: `s${index + 1}`,
				rId: `rId${index + 1}`,
				slideNumber: index + 1,
				elements: [],
				hidden: hidden.includes(index),
			}) as PptxSlide,
	);
}

function mountRail(hidden: readonly number[]): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ThumbnailRail, {
		target,
		props: {
			slides: deck(hidden),
			canvasSize: CANVAS,
			mediaDataUrls: new Map<string, string>(),
			current: 0,
			onselect: () => undefined,
		},
	});
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	flushSync();
	return target;
}

function mountSorter(hidden: readonly number[]): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SlideSorterOverlay, {
		target,
		props: {
			slides: deck(hidden),
			canvasSize: CANVAS,
			mediaDataUrls: new Map<string, string>(),
			current: 0,
			onselect: () => undefined,
			onmove: () => undefined,
			onclose: () => undefined,
		},
	});
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	flushSync();
	return target;
}

describe('thumbnailRail hidden-slide cue', () => {
	it('lists every slide and marks only the hidden one', () => {
		const target = mountRail([1]);
		const thumbs = target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-thumb');
		expect(thumbs).toHaveLength(3);
		expect(thumbs[1].getAttribute('data-pptx-slide-hidden')).toBe('true');
		expect(thumbs[0].getAttribute('data-pptx-slide-hidden')).toBeNull();
	});

	it('slashes the slide number, so the cue is not carried by dimming alone', () => {
		const target = mountRail([1]);
		const numbers = target.querySelectorAll<HTMLElement>('.pptx-svelte-thumb-number');
		expect(numbers[1].getAttribute('style')).toContain(HIDDEN_SLIDE_SLASH_GRADIENT);
		expect(numbers[0].getAttribute('style')).toBeNull();
	});

	it('describes the state without changing the accessible name', () => {
		const target = mountRail([1]);
		const thumb = target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-thumb')[1];
		expect(thumb.getAttribute('aria-label')).toBe('Go to slide 2');
		const describedBy = thumb.getAttribute('aria-describedby');
		expect(describedBy).toBe('pptx-hidden-slide-rail-1');
		expect(target.querySelector(`#${describedBy}`)?.textContent).toContain('Hidden');
	});

	it('leaves a visible slide undescribed and unbadged', () => {
		const target = mountRail([1]);
		const thumb = target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-thumb')[0];
		expect(thumb.getAttribute('aria-describedby')).toBeNull();
		expect(thumb.querySelector('.pptx-svelte-thumb-hidden')).toBeNull();
	});
});

describe('slideSorterOverlay hidden-slide cue', () => {
	it('marks the hidden tile and spells the state out in words', () => {
		const target = mountSorter([2]);
		const tiles = target.querySelectorAll<HTMLElement>('article');
		expect(tiles).toHaveLength(3);
		expect(tiles[2].getAttribute('data-pptx-slide-hidden')).toBe('true');
		expect(tiles[2].querySelector('.hidden-label')?.textContent).toBe('Hidden');
		expect(tiles[0].getAttribute('data-pptx-slide-hidden')).toBeNull();
	});

	it('describes the hidden tile from its own id space, not the rail one', () => {
		const target = mountSorter([2]);
		const preview = target
			.querySelectorAll<HTMLElement>('article')[2]
			.querySelector<HTMLButtonElement>('.preview');
		expect(preview?.getAttribute('aria-label')).toBe('Slide 3');
		expect(preview?.getAttribute('aria-describedby')).toBe('pptx-hidden-slide-sorter-2');
	});
});
