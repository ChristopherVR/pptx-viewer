import { mount } from '@vue/test-utils';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanvasSize } from '../types';
import PresentationTransitionOverlay from './PresentationTransitionOverlay.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlide(id: string): PptxSlide {
	return {
		id,
		elements: [],
		backgroundColor: '#ffffff',
	} as unknown as PptxSlide;
}

function mountOverlay(transition: PptxSlideTransition | undefined, scale = 1) {
	return mount(PresentationTransitionOverlay, {
		props: {
			outgoingSlide: makeSlide('out'),
			incomingSlide: makeSlide('in'),
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			scale,
			transition,
		},
	});
}

describe('presentationTransitionOverlay', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders two slide-stage layers (outgoing + incoming)', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		expect(wrapper.findAll('.pptx-vue-stage')).toHaveLength(2);
		wrapper.unmount();
	});

	it('injects the transition keyframes once', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		const styles = wrapper.findAll('style');
		expect(styles).toHaveLength(1);
		expect(styles[0].text()).toContain('@keyframes pptx-tr-fade-in');
		wrapper.unmount();
	});

	it('applies the resolved animation shorthands to the layers', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		const layers = wrapper.findAll('.pptx-vue-transition-layer');
		expect(layers).toHaveLength(2);
		const [outgoing, incoming] = layers;
		expect(outgoing.attributes('style')).toContain('pptx-tr-fade-out');
		expect(incoming.attributes('style')).toContain('pptx-tr-fade-in');
		wrapper.unmount();
	});

	it('orders z-index so the incoming layer sits above for push', () => {
		const wrapper = mountOverlay({ type: 'push', durationMs: 300, direction: 'l' });
		const [outgoing, incoming] = wrapper.findAll('.pptx-vue-transition-layer');
		// push → outgoingOnTop: false, so incoming z-index (2) > outgoing (1).
		expect(outgoing.attributes('style')).toContain('z-index: 1');
		expect(incoming.attributes('style')).toContain('z-index: 2');
		wrapper.unmount();
	});

	it('emits done after the configured duration (+ buffer)', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		expect(wrapper.emitted('done')).toBeUndefined();
		vi.advanceTimersByTime(300 + 49);
		expect(wrapper.emitted('done')).toBeUndefined();
		vi.advanceTimersByTime(1);
		expect(wrapper.emitted('done')).toHaveLength(1);
		wrapper.unmount();
	});

	it('emits done quickly for an instant (cut) transition', () => {
		const wrapper = mountOverlay({ type: 'cut' });
		vi.advanceTimersByTime(50);
		expect(wrapper.emitted('done')).toHaveLength(1);
		wrapper.unmount();
	});

	it('uses the default duration when none is configured', () => {
		const wrapper = mountOverlay({ type: 'fade' });
		vi.advanceTimersByTime(1000 + 49);
		expect(wrapper.emitted('done')).toBeUndefined();
		vi.advanceTimersByTime(1);
		expect(wrapper.emitted('done')).toHaveLength(1);
		wrapper.unmount();
	});

	it('does not emit done after unmount', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		wrapper.unmount();
		vi.advanceTimersByTime(1000);
		expect(wrapper.emitted('done')).toBeUndefined();
	});
});
