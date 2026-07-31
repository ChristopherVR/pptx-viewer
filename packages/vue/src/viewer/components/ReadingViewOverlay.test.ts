/**
 * Reading View, Vue binding.
 *
 * The navigation rules themselves are proved once in
 * `pptx-viewer-shared/render/reading-view`. What is worth proving here is the
 * glue that has historically rotted: that the overlay carries the neutral DOM
 * contract `e2e/` addresses all five viewers through, that it is a windowed view
 * rather than a second slide show, and that leaving it reports the slide the
 * reader ended on so the editor can land there.
 */
import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import {
	READING_VIEW_ATTR,
	READING_VIEW_COUNTER_ATTR,
	READING_VIEW_STAGE_ATTR,
} from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import type { CanvasSize } from '../types';
import ReadingViewOverlay from './ReadingViewOverlay.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlides(count: number): PptxSlide[] {
	return Array.from(
		{ length: count },
		(_, i): PptxSlide => ({ id: `slide-${i}`, elements: [] }) as unknown as PptxSlide,
	);
}

function mountOverlay(activeSlideIndex = 0, slideCount = 3) {
	return mount(ReadingViewOverlay, {
		props: {
			slides: makeSlides(slideCount),
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			activeSlideIndex,
		},
		attachTo: document.body,
	});
}

/**
 * A key press as the browser delivers it: on the focused element, travelling up
 * through `window`. Dispatching straight at `window` would make every listener
 * an at-target one and hide whether the overlay swallows the key before the
 * editor's own window-level handler sees it.
 */
function press(key: string, init: KeyboardEventInit = {}): void {
	document.body.dispatchEvent(
		new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
	);
}

/**
 * happy-dom ships no `ResizeObserver`, and without one the fit scale stays 0 and
 * the slide surface never draws. Stub one that reports a window-sized box the
 * moment it is asked to observe.
 */
class StubResizeObserver {
	constructor(private readonly callback: ResizeObserverCallback) {}
	observe(): void {
		this.callback(
			[{ contentRect: { width: 1440, height: 800 } } as ResizeObserverEntry],
			this as unknown as ResizeObserver,
		);
	}
	unobserve(): void {}
	disconnect(): void {}
}

const globals = globalThis as unknown as {
	ResizeObserver?: typeof ResizeObserver;
};
let requestFullscreen: ReturnType<typeof vi.fn>;

beforeEach(() => {
	globals.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
	requestFullscreen = vi.fn();
	Element.prototype.requestFullscreen = requestFullscreen as unknown as () => Promise<void>;
});

afterEach(() => {
	delete globals.ResizeObserver;
});

describe('reading view overlay', () => {
	it('exposes the neutral reading-view DOM contract', () => {
		const wrapper = mountOverlay();
		const root = wrapper.get(`[${READING_VIEW_ATTR}]`);

		expect(root.attributes('role')).toBe('region');
		expect(root.attributes('aria-label')).toBe('Reading View');
		expect(wrapper.find(`[${READING_VIEW_COUNTER_ATTR}]`).exists()).toBeTruthy();
	});

	it('draws the slide surface with the neutral stage marker', async () => {
		const wrapper = mountOverlay();
		// The stub reports its box during `observe()`, so the surface appears on
		// the tick after mount rather than in the first render.
		await nextTick();
		const stage = wrapper.get(`[${READING_VIEW_STAGE_ATTR}]`);

		expect(stage.attributes('aria-roledescription')).toBe('slide');
		// 1440x800 window, 24px padding: height is the binding constraint.
		expect(stage.attributes('style')).toContain('height: 752px');
	});

	it('shows the slide the editor was on, one-based', () => {
		expect(mountOverlay(1).get(`[${READING_VIEW_COUNTER_ATTR}]`).text()).toBe('2 / 3');
		expect(mountOverlay(0).get(`[${READING_VIEW_COUNTER_ATTR}]`).text()).toBe('1 / 3');
	});

	it('offers previous, next and a way back to Normal', () => {
		const labels = mountOverlay(1)
			.findAll('button')
			.map((button) => button.attributes('aria-label'));
		expect(labels).toStrictEqual(['Previous', 'Next', 'Normal view']);
	});

	it('disables previous on the first slide and leaves it live after that', () => {
		const previous = (wrapper: ReturnType<typeof mountOverlay>) =>
			wrapper.get('[aria-label="Previous"]').attributes('disabled');
		expect(previous(mountOverlay(0))).toBeDefined();
		expect(previous(mountOverlay(1))).toBeUndefined();
	});

	it('advances on the navigation keys PowerPoint uses', async () => {
		const wrapper = mountOverlay(0);

		press('ArrowRight');
		await nextTick();

		expect(wrapper.get(`[${READING_VIEW_COUNTER_ATTR}]`).text()).toBe('2 / 3');
	});

	/**
	 * The overlay covers the editor without unmounting it, and the editor's
	 * shortcut registry is still on `window`. Left alone, ArrowDown would turn
	 * the page AND nudge the selected shape, and Delete would destroy a shape the
	 * reader cannot even see: reading a deck would silently edit it.
	 */
	it('keeps keys away from the editor shortcuts still listening behind it', () => {
		const editorShortcuts = vi.fn();
		window.addEventListener('keydown', editorShortcuts);
		const wrapper = mountOverlay(0);

		press('ArrowDown');
		press('Delete');
		expect(editorShortcuts).not.toHaveBeenCalled();

		// Modifier chords are deliberately let through, so Ctrl+P still prints.
		press('p', { ctrlKey: true });
		expect(editorShortcuts).toHaveBeenCalledOnce();

		wrapper.unmount();
		window.removeEventListener('keydown', editorShortcuts);
	});

	it('reports the slide the reader ended on when they leave', async () => {
		const wrapper = mountOverlay(0);

		await wrapper.get('[aria-label="Next"]').trigger('click');
		await wrapper.get('[aria-label="Normal view"]').trigger('click');

		expect(wrapper.emitted('exit')).toStrictEqual([[1]]);
	});

	/**
	 * Reading View is the deck at full WINDOW size. If this ever starts asking
	 * for the Fullscreen API it has become a second, worse slide show.
	 */
	it('is a windowed overlay, not a fullscreen slide show', () => {
		const wrapper = mountOverlay();

		expect(wrapper.get(`[${READING_VIEW_ATTR}]`).classes()).toContain('pptx-vue-reading-view');
		expect(requestFullscreen).not.toHaveBeenCalled();
	});

	it('renders nothing when the deck is empty', () => {
		expect(mountOverlay(0, 0).find(`[${READING_VIEW_ATTR}]`).exists()).toBeFalsy();
	});
});
