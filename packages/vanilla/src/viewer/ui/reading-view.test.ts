/**
 * Reading View, VanillaJS binding.
 *
 * The navigation rules themselves are proved once in
 * `pptx-viewer-shared/render/reading-view`. What is worth proving here is the
 * glue that has historically rotted: that the overlay carries the neutral DOM
 * contract `e2e/` addresses all five viewers through, that it draws the deck
 * through the binding's own slide renderer, and that it is a WINDOWED view
 * rather than a second slide show.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import {
	READING_VIEW_ATTR,
	READING_VIEW_COUNTER_ATTR,
	READING_VIEW_STAGE_ATTR,
} from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { openReadingViewOverlay } from './reading-view';

const t = createTranslator();
const DECK = [1, 2, 3].map(
	(n) => ({ id: `s${n}`, rId: `rId${n}`, slideNumber: n, elements: [] }) as PptxSlide,
);
const CANVAS = { width: 960, height: 540 };

const requestFullscreen = vi.fn();

beforeEach(() => {
	requestFullscreen.mockClear();
	// happy-dom does not implement the Fullscreen API, so plant a spy: a Reading
	// View that ever reaches for it has quietly become a worse slide show.
	Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
		value: requestFullscreen,
		configurable: true,
		writable: true,
	});
	// happy-dom performs no layout, so the fit maths would see a 0x0 viewport
	// and honestly refuse to draw. Give every box a window-sized rect.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		width: 1200,
		height: 800,
	} as DOMRect);
});

afterEach(() => {
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

interface Opened {
	root: HTMLElement;
	onExit: ReturnType<typeof vi.fn>;
	renderStage: ReturnType<typeof vi.fn>;
}

function open(initialSlideIndex = 0, slides: PptxSlide[] = DECK): Opened {
	const onExit = vi.fn();
	const renderStage = vi.fn((slide: PptxSlide) => {
		const node = document.createElement('div');
		node.textContent = `stage:${slide.id}`;
		return node;
	});
	openReadingViewOverlay(document, document.body, t, {
		slides,
		canvasSize: CANVAS,
		initialSlideIndex,
		renderStage,
		onExit,
	});
	return {
		root: document.querySelector<HTMLElement>(`[${READING_VIEW_ATTR}]`)!,
		onExit,
		renderStage,
	};
}

function control(root: HTMLElement, label: string): HTMLButtonElement {
	const match = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing reading-view control: ${label}`);
	}
	return match;
}

function counter(root: HTMLElement): string {
	return root.querySelector(`[${READING_VIEW_COUNTER_ATTR}]`)!.textContent ?? '';
}

function press(key: string): void {
	document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('reading view overlay', () => {
	it('exposes the neutral reading-view DOM contract', () => {
		const { root } = open();
		expect(root).toBeTruthy();
		expect(root.getAttribute('role')).toBe('region');
		expect(root.getAttribute('aria-label')).toBe(t('pptx.view.readingView'));
		const stage = root.querySelector<HTMLElement>(`[${READING_VIEW_STAGE_ATTR}]`)!;
		expect(stage.getAttribute('aria-roledescription')).toBe('slide');
		expect(root.querySelector(`[${READING_VIEW_COUNTER_ATTR}]`)).toBeTruthy();
	});

	it('shows the slide the editor was on, one-based', () => {
		expect(counter(open(1).root)).toBe('2 / 3');
		document.body.replaceChildren();
		expect(counter(open(0).root)).toBe('1 / 3');
	});

	it('offers previous, next and a way back to Normal', () => {
		const { root } = open(1);
		expect(control(root, t('pptx.common.previous'))).toBeTruthy();
		expect(control(root, t('pptx.common.next'))).toBeTruthy();
		expect(control(root, t('pptx.statusBar.normalView'))).toBeTruthy();
	});

	it('disables previous on the first slide and leaves it live after that', () => {
		expect(control(open(0).root, t('pptx.common.previous')).disabled).toBeTruthy();
		document.body.replaceChildren();
		expect(control(open(1).root, t('pptx.common.previous')).disabled).toBeFalsy();
	});

	it('draws the slide through the viewer own static renderer, scaled to fit', () => {
		const { root, renderStage } = open(1);
		const stage = root.querySelector<HTMLElement>(`[${READING_VIEW_STAGE_ATTR}]`)!;
		// A 1200x800 viewport less 24px padding a side fits a 960x540 canvas at
		// (1200 - 48) / 960, the width-bound scale (letterboxed, never cropped).
		const scale = (1200 - 48) / 960;
		expect(renderStage).toHaveBeenCalledWith(DECK[1], scale);
		expect(stage.style.width).toBe(`${960 * scale}px`);
		expect(stage.textContent).toBe('stage:s2');
	});

	it('navigates by key and by control, and never caps the slide count', () => {
		const { root } = open(0);
		press('ArrowRight');
		expect(counter(root)).toBe('2 / 3');
		control(root, t('pptx.common.next')).click();
		expect(counter(root)).toBe('3 / 3');
		control(root, t('pptx.common.previous')).click();
		expect(counter(root)).toBe('2 / 3');
	});

	/**
	 * Reading View covers the editor but does not unmount it, and the editor's
	 * own shortcuts are still bound underneath. Before this, an arrow key both
	 * turned the page AND nudged the selected shape behind the overlay, so
	 * merely reading a deck silently edited it.
	 */
	it('swallows keys in the capture phase so the editor underneath never sees them', () => {
		open(0);
		const event = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			bubbles: true,
			cancelable: true,
		});
		const stopPropagation = vi.spyOn(event, 'stopPropagation');
		const editor = vi.fn();
		// Registered AFTER the overlay: only capture-phase interception at the
		// document can stop a key reaching a listener bound this late.
		document.addEventListener('keydown', editor);
		document.dispatchEvent(event);
		document.removeEventListener('keydown', editor);
		expect(stopPropagation).toHaveBeenCalledWith();
		expect(editor).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBeTruthy();
	});

	it('lets modifier chords through so Ctrl+P still prints', () => {
		open(0);
		const chord = new KeyboardEvent('keydown', {
			key: 'p',
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		});
		const stopPropagation = vi.spyOn(chord, 'stopPropagation');
		document.dispatchEvent(chord);
		expect(stopPropagation).not.toHaveBeenCalled();
		expect(chord.defaultPrevented).toBeFalsy();
	});

	it('returns the reader to the editor on the slide they stopped at', () => {
		const { root, onExit } = open(0);
		press('ArrowRight');
		press('Escape');
		expect(document.querySelector(`[${READING_VIEW_ATTR}]`)).toBeNull();
		// The listener has to go with the node, or the closed view keeps eating
		// the editor's arrow keys.
		press('ArrowRight');
		expect(onExit).toHaveBeenCalledExactlyOnceWith(1);
		expect(root.isConnected).toBeFalsy();
	});

	it('closes when the reader advances past the last slide', () => {
		const { root, onExit } = open(2);
		control(root, t('pptx.common.next')).click();
		expect(onExit).toHaveBeenCalledWith(2);
		expect(document.querySelector(`[${READING_VIEW_ATTR}]`)).toBeNull();
	});

	/**
	 * Reading View is the deck at full WINDOW size. If this ever starts asking
	 * for the Fullscreen API it has become a second, worse slide show.
	 */
	it('is a windowed overlay, not a fullscreen slide show', () => {
		const { root } = open();
		expect(requestFullscreen).not.toHaveBeenCalled();
		expect(root.className).toContain('pptxv-reading-view');
		expect(document.fullscreenElement ?? null).toBeNull();
	});

	it('renders nothing when the deck is empty', () => {
		const handle = openReadingViewOverlay(document, document.body, t, {
			slides: [],
			canvasSize: CANVAS,
			initialSlideIndex: 0,
			renderStage: vi.fn(),
			onExit: vi.fn(),
		});
		expect(handle).toBeNull();
		expect(document.querySelector(`[${READING_VIEW_ATTR}]`)).toBeNull();
	});
});
