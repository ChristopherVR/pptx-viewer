/**
 * Reading View, Svelte binding.
 *
 * The navigation rules are proved once in
 * `pptx-viewer-shared/render/reading-view`. What is worth proving here is the
 * glue that has historically rotted: that the overlay carries the neutral DOM
 * contract `e2e/` addresses all five viewers through, and that it stays a
 * WINDOWED view rather than quietly becoming a second slide show.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { READING_VIEW_ATTR, READING_VIEW_COUNTER_ATTR } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ReadingViewOverlay from './ReadingViewOverlay.svelte';

let cleanup: (() => void) | undefined;
const requestFullscreen = vi.fn();

beforeEach(() => {
	requestFullscreen.mockClear();
	// happy-dom does not implement the Fullscreen API; installing a spy is the
	// only way an accidental call could ever be observed.
	Object.defineProperty(Element.prototype, 'requestFullscreen', {
		value: requestFullscreen,
		configurable: true,
		writable: true,
	});
});

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const slide = (id: string): PptxSlide =>
	({ id, elements: [], slideNumber: 1 }) as unknown as PptxSlide;

const DECK = [slide('s1'), slide('s2'), slide('s3')];

function mountOverlay(
	activeSlideIndex = 0,
	slides: PptxSlide[] = DECK,
	onexit: (index: number) => void = vi.fn(),
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ReadingViewOverlay, {
		target,
		props: {
			slides,
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map<string, string>(),
			activeSlideIndex,
			onexit,
		},
	});
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	// The capture-phase key listener is installed by an effect, so it is only
	// live once the first flush has run.
	flushSync();
	return target;
}

const counterText = (target: HTMLElement): string =>
	target.querySelector(`[${READING_VIEW_COUNTER_ATTR}]`)?.textContent?.trim() ?? '';

const previous = (target: HTMLElement): HTMLButtonElement | null =>
	target.querySelector<HTMLButtonElement>('button[aria-label="Previous"]');

/** Dispatch from inside the document, so the capture path is the real one. */
function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
		...init,
	});
	document.body.dispatchEvent(event);
	flushSync();
	return event;
}

describe('readingViewOverlay', () => {
	it('exposes the neutral reading-view DOM contract', () => {
		const target = mountOverlay();
		const root = target.querySelector(`[${READING_VIEW_ATTR}]`);

		expect(root).toBeTruthy();
		expect(root?.getAttribute('role')).toBe('region');
		expect(root?.getAttribute('aria-label')).toBe('Reading View');
		expect(target.querySelector(`[${READING_VIEW_COUNTER_ATTR}]`)).toBeTruthy();
	});

	it('shows the slide the editor was on, one-based', () => {
		expect(counterText(mountOverlay(1))).toBe('2 / 3');
		cleanup?.();
		expect(counterText(mountOverlay(0))).toBe('1 / 3');
	});

	it('offers previous, next and a way back to Normal', () => {
		const target = mountOverlay(1);

		for (const label of ['Previous', 'Next', 'Normal view']) {
			const button = target.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
			expect(button, `${label} control is missing`).toBeTruthy();
			expect(button?.title, `${label} needs a tooltip too`).toBe(label);
		}
	});

	it('disables previous on the first slide and leaves it live after that', () => {
		expect(previous(mountOverlay(0))?.disabled).toBeTruthy();
		cleanup?.();
		expect(previous(mountOverlay(1))?.disabled).toBeFalsy();
	});

	it('navigates by key and by control, and exits on the slide reached', () => {
		const onexit = vi.fn();
		const target = mountOverlay(0, DECK, onexit);

		press('ArrowRight');
		expect(counterText(target)).toBe('2 / 3');

		target.querySelector<HTMLButtonElement>('button[aria-label="Next"]')?.click();
		flushSync();
		expect(counterText(target)).toBe('3 / 3');

		previous(target)?.click();
		flushSync();
		expect(counterText(target)).toBe('2 / 3');

		target.querySelector<HTMLButtonElement>('button[aria-label="Normal view"]')?.click();
		flushSync();
		expect(onexit).toHaveBeenCalledWith(1);
	});

	/**
	 * The overlay covers the editor but does not unmount it, and the editor
	 * listens for its own shortcuts on `window`. Before the capture-phase
	 * listener, an arrow key both turned the page AND nudged the selected shape
	 * behind the overlay: merely reading a deck silently edited it.
	 */
	it('swallows keys before the editor underneath can act on them', () => {
		const editorShortcut = vi.fn();
		window.addEventListener('keydown', editorShortcut);
		try {
			const target = mountOverlay(0);

			const arrow = press('ArrowRight');
			expect(counterText(target)).toBe('2 / 3');
			expect(arrow.defaultPrevented).toBeTruthy();
			expect(editorShortcut).not.toHaveBeenCalled();

			// A bare Delete would destroy a shape the reader cannot even see.
			press('Delete');
			expect(editorShortcut).not.toHaveBeenCalled();

			// Modifier chords are deliberately let through: Ctrl+P must still print.
			const chord = press('p', { ctrlKey: true });
			expect(editorShortcut).toHaveBeenCalledOnce();
			expect(chord.defaultPrevented).toBeFalsy();
		} finally {
			window.removeEventListener('keydown', editorShortcut);
		}
	});

	/**
	 * Reading View is the deck at full WINDOW size. If this ever starts asking
	 * for the Fullscreen API it has become a second, worse slide show.
	 */
	it('is a windowed overlay, not a fullscreen slide show', () => {
		const target = mountOverlay();

		press('ArrowRight');

		expect(requestFullscreen).not.toHaveBeenCalled();
		// None of the slide-show-only chrome leaked in.
		expect(target.textContent).not.toContain('Presenter');
		expect(target.textContent).not.toContain('Laser');
	});

	it('renders nothing when the deck is empty', () => {
		const target = mountOverlay(0, []);

		expect(target.querySelector(`[${READING_VIEW_ATTR}]`)).toBeNull();
	});
});
