import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { mount } from '@vue/test-utils';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanvasSize } from '../types';
import PresentationTransitionOverlay from './PresentationTransitionOverlay.vue';

/**
 * The SFC's own text. `import.meta.url` is not a file URL under the happy-dom
 * environment, so the path is resolved from the working directory instead
 * (vitest runs from the package root; the second candidate covers a repo-root
 * invocation).
 */
const overlaySource = readFileSync(
	[
		'src/viewer/components/PresentationTransitionOverlay.vue',
		'packages/vue/src/viewer/components/PresentationTransitionOverlay.vue',
	]
		.map((candidate) => resolve(process.cwd(), candidate))
		.find((candidate) => existsSync(candidate))!,
	'utf8',
);

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlide(id: string, elements: unknown[] = []): PptxSlide {
	return {
		id,
		elements,
		backgroundColor: '#ffffff',
	} as unknown as PptxSlide;
}

/**
 * One shape per slide, so `buildMorphTransitionPlan` has something to pair and
 * actually returns a plan (it bails out on two empty slides).
 */
function morphable(slideId: string, x: number): PptxSlide {
	return makeSlide(slideId, [
		{
			id: `${slideId}-shape`,
			type: 'shape',
			name: 'Rectangle 1',
			x,
			y: 10,
			width: 100,
			height: 50,
			shapeType: 'rect',
		},
	]);
}

function mountOverlay(transition: PptxSlideTransition | undefined, scale = 1) {
	const morph = transition?.type === 'morph';
	return mount(PresentationTransitionOverlay, {
		props: {
			outgoingSlide: morph ? morphable('out', 10) : makeSlide('out'),
			incomingSlide: morph ? morphable('in', 400) : makeSlide('in'),
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

	// -------------------------------------------------------------------------
	// What a viewer actually SEES. Both regressions below shipped while every
	// structural assertion above still passed.
	// -------------------------------------------------------------------------

	it('paints no slide background on the morph departing layer', () => {
		const wrapper = mountOverlay({ type: 'morph', durationMs: 800 });
		const [outgoing, incoming] = wrapper.findAll('.pptx-vue-stage');
		// The departing shapes float over the incoming slide, so the layer has to
		// be see-through. `getSlideBackgroundStyle` always resolves to an OPAQUE
		// paint (it falls back to #ffffff), so inheriting it hid the whole morph
		// behind a flat slab for the entire transition.
		expect(wrapper.findAll('[data-pptx-morph-outgoing]')).not.toHaveLength(0);
		expect(outgoing.attributes('style')).toMatch(/background:\s*none transparent|transparent/u);
		expect(outgoing.attributes('style')).not.toContain('#ffffff');
		// The incoming layer is a real surface and keeps its background.
		expect(incoming.attributes('style')).toContain('background-color: #ffffff');
		wrapper.unmount();
	});

	it('keeps the slide background on a non-morph transition snapshot', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		for (const stage of wrapper.findAll('.pptx-vue-stage')) {
			expect(stage.attributes('style')).toContain('background-color: #ffffff');
		}
		wrapper.unmount();
	});

	it('stretches each transition layer to the overlay instead of shrink-wrapping it', () => {
		// jsdom has no layout engine, so this is asserted on the rule itself. The
		// stage inside a layer scales with `transform`, which never changes its
		// laid-out box: an auto-sized `top/left` layer therefore measures the
		// deck's NATIVE size and `overflow: hidden` crops the transition to that
		// corner of a larger display (1280x720 of a 1920x1080 show).
		const layerRule = /\.pptx-vue-transition-layer\s*\{([^}]*)\}/u.exec(overlaySource)?.[1] ?? '';
		expect(layerRule).toContain('position: absolute');
		expect(layerRule).toContain('overflow: hidden');
		expect(layerRule, 'a clipped layer must fill its overlay, not its content').toMatch(
			/inset:\s*0|width:\s*100%/u,
		);
		expect(layerRule).not.toMatch(/top:\s*0;\s*\n?\s*left:\s*0;/u);
	});
});
