import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import PresentationMode from './PresentationMode.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlide(id: string): PptxSlide {
	return {
		id,
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

function mountMode(slides: PptxSlide[], startIndex = 0, startInPresenterView = false) {
	return mount(PresentationMode, {
		props: {
			slides,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			startIndex,
			startInPresenterView,
		},
		attachTo: document.body,
	});
}

function pressKey(key: string): void {
	window.dispatchEvent(new KeyboardEvent('keydown', { key }));
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
});
