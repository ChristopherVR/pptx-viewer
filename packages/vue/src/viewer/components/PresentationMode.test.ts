import { mount } from '@vue/test-utils';
import type { PptxPresentationProperties, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import type { CanvasSize } from '../types';
import PresentationMode from './PresentationMode.vue';

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
		expect(document.querySelector('.pptx-vue-presentation-counter')?.textContent).toContain(
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
		expect(document.querySelector('.pptx-vue-presentation-counter')?.textContent).toContain(
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
		expect(document.querySelector('.pptx-vue-presentation-counter')?.textContent).toContain(
			'1 / 2',
		);
		await settle();
		expect(wrapper.emitted('slide-change')?.[0]).toStrictEqual([1]);
		expect(document.querySelector('.pptx-vue-presentation-counter')?.textContent).toContain(
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
