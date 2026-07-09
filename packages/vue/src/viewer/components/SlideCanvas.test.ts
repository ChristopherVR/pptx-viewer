import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import SlideCanvas from './SlideCanvas.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlide(overrides: Partial<PptxSlide>): PptxSlide {
	return { id: 'slide-1', elements: [], ...overrides } as unknown as PptxSlide;
}

function mountCanvas(slide: PptxSlide | undefined) {
	return mount(SlideCanvas, {
		props: { slide, canvasSize, mediaDataUrls: new Map<string, string>() },
	});
}

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
