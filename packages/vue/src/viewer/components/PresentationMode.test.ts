import { mount } from '@vue/test-utils';
import type { PptxPresentationProperties, PptxSlide } from 'pptx-viewer-core';
import {
	hasPersistentAudio,
	registerPersistentAudio,
	stopAllPersistentAudio,
} from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import type { CanvasSize } from '../types';
import PresentationMode from './PresentationMode.vue';

beforeEach(() => {
	// jsdom reports hasFocus() false by default; the visibility-pause helper
	// treats an unfocused window as suspended, so pin the baseline to focused.
	vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlide(id: string): PptxSlide {
	return {
		id,
		rId: `r-${id}`,
		elements: [],
		backgroundColor: '#ffffff',
	} as unknown as PptxSlide;
}

function makeSlideNoClickAdvance(id: string): PptxSlide {
	return {
		id,
		elements: [],
		backgroundColor: '#ffffff',
		transition: { type: 'fade', advanceOnClick: false },
	} as unknown as PptxSlide;
}

/**
 * Slide 1 of `e2e/fixtures/solution-explorer.pptx`: `advClick="0" advTm="10"`,
 * i.e. "on mouse click" OFF and "after 10 ms" ON. Its timing is the only thing
 * that can move the show off it.
 */
function makeTimedSlide(id: string): PptxSlide {
	return {
		id,
		elements: [],
		backgroundColor: '#ffffff',
		transition: { type: 'fade', advanceOnClick: false, advanceAfterMs: 10 },
	} as unknown as PptxSlide;
}

function makeHiddenSlide(id: string): PptxSlide {
	return {
		id,
		rId: `r-${id}`,
		elements: [],
		backgroundColor: '#ffffff',
		hidden: true,
	} as unknown as PptxSlide;
}

function mountMode(
	slides: PptxSlide[],
	startIndex = 0,
	startInPresenterView = false,
	presentationProperties?: PptxPresentationProperties,
	extraProps: Record<string, unknown> = {},
) {
	return mount(PresentationMode, {
		props: {
			slides,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			startIndex,
			startInPresenterView,
			presentationProperties,
			...extraProps,
		},
		attachTo: document.body,
	});
}

function pressKey(key: string): void {
	window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

/** Right-click the (teleported) presentation overlay to open its context menu. */
function rightClickOverlay(): void {
	const overlay = document.querySelector('.pptx-vue-presentation');
	overlay?.dispatchEvent(
		new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 }),
	);
}

/** Let a 10 ms authored timing elapse and Vue flush the resulting render. */
async function settle(): Promise<void> {
	await new Promise((resolve) => {
		setTimeout(resolve, 60);
	});
	await nextTick();
}

describe('presentationMode', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('renders a slide stage for the active slide', () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2')]);
		expect(document.querySelector('.pptx-vue-stage')).not.toBeNull();
		expect(document.querySelector('[data-pptx-present-control="counter"]')?.textContent).toContain(
			'1 / 2',
		);
		wrapper.unmount();
	});

	it('opens directly in presenter view when requested by the ribbon', () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2')], 0, true);
		expect(document.querySelector('.pptx-vue-presenter')).not.toBeNull();
		wrapper.unmount();
	});

	it('advances on ArrowRight and emits slide-change', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2'), makeSlide('s3')]);
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		expect(document.querySelector('[data-pptx-present-control="counter"]')?.textContent).toContain(
			'2 / 3',
		);
		wrapper.unmount();
	});

	it('goes back on ArrowLeft', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2'), makeSlide('s3')], 2);
		pressKey('ArrowLeft');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		wrapper.unmount();
	});

	it('clamps navigation at the boundaries', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2')], 0);
		pressKey('ArrowLeft');
		await wrapper.vm.$nextTick();
		// Already at first slide → no slide-change emitted.
		expect(wrapper.emitted('slide-change')).toBeUndefined();
		wrapper.unmount();
	});

	it('jumps to last slide on End and first on Home', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2'), makeSlide('s3')], 0);
		pressKey('End');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.at(-1)).toStrictEqual([2]);
		pressKey('Home');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.at(-1)).toStrictEqual([0]);
		wrapper.unmount();
	});

	it('emits close on Escape', () => {
		const wrapper = mountMode([makeSlide('s1')]);
		pressKey('Escape');
		expect(wrapper.emitted('close')).toHaveLength(1);
		wrapper.unmount();
	});

	it('emits close when the touch close button is clicked', async () => {
		// The persistent close control lives in the touch-only
		// PresentationTouchControls overlay, so make the device report touch.
		const original = navigator.maxTouchPoints;
		Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
		const wrapper = mountMode([makeSlide('s1')]);
		await wrapper.vm.$nextTick();
		const button = document.querySelector<HTMLButtonElement>('.pptx-vue-pt-close');
		button?.click();
		expect(wrapper.emitted('close')).toHaveLength(1);
		wrapper.unmount();
		Object.defineProperty(navigator, 'maxTouchPoints', { value: original, configurable: true });
	});

	it('advances when the overlay is clicked', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2')]);
		const overlay = document.querySelector<HTMLDivElement>('.pptx-vue-presentation');
		overlay?.click();
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		wrapper.unmount();
	});

	it('does not advance on overlay click when advanceOnClick is false', async () => {
		const wrapper = mountMode([makeSlideNoClickAdvance('s1'), makeSlide('s2')]);
		const overlay = document.querySelector<HTMLDivElement>('.pptx-vue-presentation');
		overlay?.click();
		await wrapper.vm.$nextTick();
		// The click on the slide is suppressed by the transition flag.
		expect(wrapper.emitted('slide-change')).toBeUndefined();
		wrapper.unmount();
	});

	it('still advances via keyboard when advanceOnClick is false', async () => {
		const wrapper = mountMode([makeSlideNoClickAdvance('s1'), makeSlide('s2')]);
		// Explicit navigation (ArrowRight) is never gated by advanceOnClick.
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		wrapper.unmount();
	});

	// PowerPoint's "Advance slide: After <n>" (`p:transition/@advTm`). A slide
	// authored `advClick="0" advTm="10"` has NO other way forward, so a show that
	// only honours the click gate sits on it for ever and looks completely dead.
	it('advances on the slide timing when click-advance is forbidden', async () => {
		const wrapper = mountMode([makeTimedSlide('s1'), makeSlide('s2')]);
		expect(document.querySelector('[data-pptx-present-control="counter"]')?.textContent).toContain(
			'1 / 2',
		);
		await settle();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		expect(document.querySelector('[data-pptx-present-control="counter"]')?.textContent).toContain(
			'2 / 2',
		);
		wrapper.unmount();
	});

	it('ignores authored timings when the show advances manually', async () => {
		const wrapper = mountMode([makeTimedSlide('s1'), makeSlide('s2')], 0, false, {
			advanceMode: 'manual',
		});
		await settle();
		expect(wrapper.emitted('slide-change')).toBeUndefined();
		wrapper.unmount();
	});

	it('does not keep advancing a slide with no timing of its own', async () => {
		const wrapper = mountMode([makeTimedSlide('s1'), makeSlide('s2'), makeSlide('s3')]);
		await settle();
		// The timer belongs to slide 1 only; slide 2 waits for input.
		expect(wrapper.emitted('slide-change')).toHaveLength(1);
		await settle();
		expect(wrapper.emitted('slide-change')).toHaveLength(1);
		wrapper.unmount();
	});
});

// ---------------------------------------------------------------------------
// A hidden tab is a paused show (visibility pause + cross-slide audio)
// ---------------------------------------------------------------------------

function setVisibility(state: 'visible' | 'hidden'): void {
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => state,
	});
	document.dispatchEvent(new Event('visibilitychange'));
}

describe('presentationMode visibility pause', () => {
	afterEach(() => {
		stopAllPersistentAudio();
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'visible',
		});
		document.body.replaceChildren();
	});

	it('cancels the timed auto-advance while the tab is hidden and re-arms it when visible', async () => {
		const wrapper = mountMode([makeTimedSlide('s1'), makeSlide('s2')]);
		// Hide before the 10 ms timing elapses: the deck must not run on unseen.
		setVisibility('hidden');
		await settle();
		expect(wrapper.emitted('slide-change')).toBeUndefined();

		// Back on screen: the current slide's timing re-arms from scratch.
		setVisibility('visible');
		await settle();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		wrapper.unmount();
	});

	it('stops cross-slide persistent audio on exit, not on slide change', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2')]);
		registerPersistentAudio('bg-track', 'data:audio/mpeg;base64,AAAA', 'audio/mpeg', true, 1, 0);
		expect(hasPersistentAudio('bg-track')).toBeTruthy();

		// A slide change leaves the track playing (that is the whole feature).
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		expect(hasPersistentAudio('bg-track')).toBeTruthy();

		// Unmounting the overlay is the show's exit: the track ends with it.
		wrapper.unmount();
		expect(hasPersistentAudio('bg-track')).toBeFalsy();
		expect(document.querySelectorAll('[data-pptx-persistent-audio]')).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Hidden slides ("Hide Slide") are skipped by the running show
// ---------------------------------------------------------------------------

describe('presentationMode hidden slides', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('skips a hidden slide advancing forward', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeHiddenSlide('s2'), makeSlide('s3')]);
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([2]);
		wrapper.unmount();
	});

	it('skips a hidden slide going backward', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeHiddenSlide('s2'), makeSlide('s3')], 2);
		pressKey('ArrowLeft');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([0]);
		wrapper.unmount();
	});

	it('ends the show at the last VISIBLE slide when trailing slides are hidden', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeHiddenSlide('s2'), makeHiddenSlide('s3')]);
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		// No slide change: the black end-of-show screen goes up instead.
		expect(wrapper.emitted('slide-change')).toBeUndefined();
		expect(document.querySelector('.pptx-vue-presentation-end')).not.toBeNull();
		wrapper.unmount();
	});

	it('lands Home / End on the first / last VISIBLE slide', async () => {
		const wrapper = mountMode(
			[makeHiddenSlide('s1'), makeSlide('s2'), makeSlide('s3'), makeHiddenSlide('s4')],
			1,
		);
		pressKey('End');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.at(-1)).toStrictEqual([2]);
		pressKey('Home');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.at(-1)).toStrictEqual([1]);
		wrapper.unmount();
	});

	it('still reaches a hidden slide by its typed slide number', async () => {
		// PowerPoint's documented escape hatch for backup slides: type the number.
		const wrapper = mountMode([makeSlide('s1'), makeHiddenSlide('s2'), makeSlide('s3')]);
		pressKey('2');
		pressKey('Enter');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.at(-1)).toStrictEqual([1]);
		wrapper.unmount();
	});

	it('escapes forward from a hidden slide reached by number', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeHiddenSlide('s2'), makeSlide('s3')], 1);
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([2]);
		wrapper.unmount();
	});

	it('follows an active custom show membership and order', async () => {
		const wrapper = mountMode(
			[makeSlide('s1'), makeSlide('s2'), makeSlide('s3')],
			0,
			false,
			undefined,
			{ activeCustomShow: { slideRIds: ['r-s1', 'r-s3'] } },
		);
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([2]);
		wrapper.unmount();
	});
});

// ---------------------------------------------------------------------------
// End of show ("End with black slide")
// ---------------------------------------------------------------------------

describe('presentationMode end of show', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('raises the black end screen by default', async () => {
		const wrapper = mountMode([makeSlide('s1')]);
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		expect(document.querySelector('.pptx-vue-presentation-end')).not.toBeNull();
		expect(wrapper.emitted('close')).toBeUndefined();
		wrapper.unmount();
	});

	it('exits the show outright when the option is off', async () => {
		const wrapper = mountMode([makeSlide('s1')], 0, false, undefined, {
			endWithBlackSlide: false,
		});
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		expect(document.querySelector('.pptx-vue-presentation-end')).toBeNull();
		expect(wrapper.emitted('close')).toHaveLength(1);
		wrapper.unmount();
	});

	it('exits on a second forward press from the end screen', async () => {
		const wrapper = mountMode([makeSlide('s1')]);
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		pressKey('ArrowRight');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('close')).toHaveLength(1);
		wrapper.unmount();
	});
});

describe('presentationMode right-click menu', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('opens a menu on right-click by default', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2')]);
		rightClickOverlay();
		await wrapper.vm.$nextTick();
		expect(document.querySelector('[data-pptx-context-menu]')).not.toBeNull();
		expect(document.querySelector('[data-item-id="next"]')).not.toBeNull();
		expect(document.querySelector('[data-item-id="endShow"]')).not.toBeNull();
		wrapper.unmount();
	});

	it('never opens when the option is off', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2')], 0, false, undefined, {
			showMenuOnRightClick: false,
		});
		rightClickOverlay();
		await wrapper.vm.$nextTick();
		expect(document.querySelector('[data-pptx-context-menu]')).toBeNull();
		wrapper.unmount();
	});

	it('advances the slide and closes when "Next Slide" is chosen', async () => {
		const wrapper = mountMode([makeSlide('s1'), makeSlide('s2')]);
		rightClickOverlay();
		await wrapper.vm.$nextTick();
		const next = document.querySelector<HTMLButtonElement>('[data-item-id="next"]');
		next?.click();
		await wrapper.vm.$nextTick();
		expect(document.querySelector('[data-pptx-context-menu]')).toBeNull();
		expect(wrapper.emitted('slide-change')?.at(-1)).toStrictEqual([1]);
		wrapper.unmount();
	});

	it('ends the show when "End Presentation" is chosen', async () => {
		const wrapper = mountMode([makeSlide('s1')]);
		rightClickOverlay();
		await wrapper.vm.$nextTick();
		const end = document.querySelector<HTMLButtonElement>('[data-item-id="endShow"]');
		end?.click();
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('close')).toHaveLength(1);
		wrapper.unmount();
	});
});

describe('presentationMode popup toolbar', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('reveals the floating toolbar on mousemove by default', async () => {
		const wrapper = mountMode([makeSlide('s1')]);
		window.dispatchEvent(new MouseEvent('mousemove'));
		await wrapper.vm.$nextTick();
		expect(document.querySelector('.pptx-vue-presentation-toolbar-slot.is-visible')).not.toBeNull();
		wrapper.unmount();
	});

	it('never auto-reveals when the option is off', async () => {
		const wrapper = mountMode([makeSlide('s1')], 0, false, undefined, {
			showPopupToolbar: false,
		});
		window.dispatchEvent(new MouseEvent('mousemove'));
		await wrapper.vm.$nextTick();
		expect(document.querySelector('.pptx-vue-presentation-toolbar-slot.is-visible')).toBeNull();
		wrapper.unmount();
	});
});

describe('presentationMode @highlightClick flash', () => {
	function slideWithHighlightShape(): PptxSlide {
		return {
			id: 's1',
			backgroundColor: '#ffffff',
			elements: [
				{
					id: 'shape-1',
					type: 'shape',
					x: 10,
					y: 10,
					width: 100,
					height: 50,
					shapeType: 'rect',
					actionClick: { action: 'ppaction://noaction', highlightClick: true },
					actionHover: { action: 'ppaction://noaction', highlightClick: true },
				},
			],
		} as unknown as PptxSlide;
	}

	it('flashes the shape on click and clears it after the duration', async () => {
		const wrapper = mountMode([slideWithHighlightShape()]);
		await nextTick();
		const shape = document.querySelector<HTMLElement>('[data-element-id="shape-1"]');
		expect(shape).not.toBeNull();
		vi.useFakeTimers();
		shape!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(shape!.style.filter).toBe('brightness(1.18)');
		// jsdom decomposes the `outline` shorthand into longhand properties, so
		// the shorthand getter's token order is not guaranteed; assert the
		// longhand values instead of the reassembled string.
		expect(shape!.style.outlineWidth).toBe('2px');
		expect(shape!.style.outlineStyle).toBe('solid');
		expect(shape!.style.outlineColor).toBe('rgba(59, 130, 246, 0.6)');
		vi.advanceTimersByTime(320);
		expect(shape!.style.filter).toBe('');
		expect(shape!.style.outlineWidth).toBe('');
		vi.useRealTimers();
		wrapper.unmount();
	});

	it('flashes the shape on hover and clears it on mouseout', async () => {
		const wrapper = mountMode([slideWithHighlightShape()]);
		await nextTick();
		const shape = document.querySelector<HTMLElement>('[data-element-id="shape-1"]');
		expect(shape).not.toBeNull();
		shape!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		expect(shape!.style.filter).toBe('brightness(1.15)');
		expect(shape!.style.outlineColor).toBe('rgba(59, 130, 246, 0.5)');
		shape!.dispatchEvent(
			new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }),
		);
		expect(shape!.style.filter).toBe('');
		expect(shape!.style.outlineWidth).toBe('');
		wrapper.unmount();
	});
});
