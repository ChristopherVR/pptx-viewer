import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CanvasSize } from '../types';
import SlideCanvas from './SlideCanvas.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function makeSlide(overrides: Partial<PptxSlide>): PptxSlide {
	return { id: 'slide-1', elements: [], ...overrides } as unknown as PptxSlide;
}

function mountCanvas(slide: PptxSlide | undefined) {
	return mount(SlideCanvas, {
		props: { slide, canvasSize, mediaDataUrls: new Map<string, string>() },
	});
}

describe('slideCanvas slide-region contract', () => {
	// The e2e accessibility contract is ONE visible slide region for the
	// current slide: the wrapper. The inner interactive SlideStage must not
	// duplicate the aria-roledescription (a strict Playwright locator on
	// '[aria-roledescription="slide"]' resolved to 2 elements before this).
	it('renders exactly one aria-roledescription="slide" region', () => {
		const wrapper = mountCanvas(makeSlide({}));
		expect(wrapper.findAll('[aria-roledescription="slide"]')).toHaveLength(1);
		const region = wrapper.get('[aria-roledescription="slide"]');
		expect(region.classes()).toContain('pptx-vue-canvas-wrapper');
	});
});

describe('slideCanvas background inheritance', () => {
	// The e2e contract reads the background off the aria-roledescription="slide"
	// region (the wrapper), mirroring React/Angular. A slide whose background is
	// inherited from its master/layout arrives with `backgroundColor` already
	// resolved by core, so the labelled region must paint it (not stay
	// transparent).
	it('paints the resolved slide background on the slide region', () => {
		const wrapper = mountCanvas(makeSlide({ backgroundColor: '#000000' }));
		const region = wrapper.get('[aria-roledescription="slide"]');
		expect(region.attributes('style')).toContain('background-color: #000000');
	});

	it('falls back to white when no background is resolved', () => {
		const wrapper = mountCanvas(makeSlide({}));
		const region = wrapper.get('[aria-roledescription="slide"]');
		expect(region.attributes('style')).toContain('background-color: #ffffff');
	});

	it('treats an explicit "transparent" background as the white fallback', () => {
		const wrapper = mountCanvas(makeSlide({ backgroundColor: 'transparent' }));
		const region = wrapper.get('[aria-roledescription="slide"]');
		expect(region.attributes('style')).toContain('background-color: #ffffff');
	});
});

describe('slideCanvas viewport fit policy', () => {
	it('declares host fit options as runtime props on the public viewer', async () => {
		const { default: Viewer } = await import('../PowerPointViewer.vue');
		expect(Viewer.props).toHaveProperty('fitPadding');
		expect(Viewer.props).toHaveProperty('maxFitScale');
	});

	function measuredCanvas(width = 960, height = 540) {
		vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
		vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height);
		return mountCanvas(makeSlide({}));
	}

	it('preserves default padding and responds to explicit padding changes', async () => {
		const wrapper = measuredCanvas();
		const fit = () => wrapper.emitted('update:fitScale')!.at(-1)![0];
		expect(fit()).toBeCloseTo(508 / 540);
		await wrapper.setProps({ fitPadding: 0 });
		expect(fit()).toBe(1);
		await wrapper.setProps({ fitPadding: { horizontal: 80, vertical: 0 } });
		expect(fit()).toBeCloseTo(800 / 960);
		wrapper.unmount();
	});

	it('can opt into enlargement or a finite cap without changing supplied zoom', async () => {
		const wrapper = measuredCanvas(1920, 1080);
		const fit = () => wrapper.emitted('update:fitScale')!.at(-1)![0];
		expect(fit()).toBe(1);
		await wrapper.setProps({ fitPadding: 0, maxFitScale: null, zoom: 3 });
		expect(fit()).toBe(2);
		expect(wrapper.get('[aria-roledescription="slide"]').attributes('style')).toContain(
			'width: 2880px',
		);
		await wrapper.setProps({ maxFitScale: 1.5 });
		expect(fit()).toBe(1.5);
		await wrapper.setProps({ maxFitScale: -1, fitPadding: -1 });
		expect(fit()).toBe(1);
		wrapper.unmount();
	});

	it('retains ruler gutters in default and zero-padding modes', async () => {
		const wrapper = measuredCanvas();
		const fit = () => wrapper.emitted('update:fitScale')!.at(-1)![0];
		await wrapper.setProps({ showRulers: true });
		expect(fit()).toBeCloseTo(488 / 540);
		await wrapper.setProps({ fitPadding: 0 });
		expect(fit()).toBeCloseTo(920 / 960);
		await wrapper.setProps({ showRulers: false });
		expect(fit()).toBe(1);
		wrapper.unmount();
	});

	it('remeasures fit on resize without altering authored canvas dimensions', async () => {
		let resize = () => {};
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(callback: () => void) {
					resize = callback;
				}
				observe() {}
				disconnect() {}
			},
		);
		const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(960);
		const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(540);
		const wrapper = mountCanvas(makeSlide({}));
		await wrapper.setProps({ fitPadding: 0, maxFitScale: null });
		width.mockReturnValue(1920);
		height.mockReturnValue(1080);
		resize();
		expect(wrapper.emitted('update:fitScale')!.at(-1)![0]).toBe(2);
		expect(wrapper.props('canvasSize')).toStrictEqual({ width: 960, height: 540 });
		wrapper.unmount();
	});
});
