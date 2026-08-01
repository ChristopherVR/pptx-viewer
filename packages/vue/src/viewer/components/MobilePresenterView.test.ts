import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import MobilePresenterView from './MobilePresenterView.vue';

/**
 * The phone console obeys the DESKTOP console's navigation rules.
 *
 * `PresenterView.test.ts` pins those rules for the split-screen console:
 * Previous is dead only on the first slide, and Next is never dead, because
 * PowerPoint advances from the last slide to the end-of-show screen and then
 * out of the show. This layout was written against a near-duplicate helper
 * (`isLastSlide`) and disabled Next on the last slide, so the same deck
 * stranded a presenter on a phone and let them finish on a laptop.
 *
 * Both controls also carry `data-pptx-presenter-control`, the neutral contract
 * `e2e/presenter-view-parity.spec.ts` measures every binding through: without
 * it the phone console is invisible to the parity suite, which is how the
 * divergence survived a whole parity pass.
 */

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlide(id: string): PptxSlide {
	return { id, elements: [], backgroundColor: '#ffffff' } as unknown as PptxSlide;
}

function mountConsole(slides: PptxSlide[], currentSlideIndex: number) {
	return mount(MobilePresenterView, {
		props: {
			slides,
			currentSlideIndex,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			presentationStartTime: null,
		},
		global: {
			mocks: { t: (key: string) => key },
		},
	});
}

function navButton(wrapper: ReturnType<typeof mountConsole>, id: string) {
	return wrapper.find(`[data-pptx-presenter-control="${id}"]`);
}

describe('the phone presenter console', () => {
	it('disables Previous only on the first slide', () => {
		expect(
			navButton(mountConsole([makeSlide('a'), makeSlide('b')], 0), 'prev').attributes(),
		).toHaveProperty('disabled');
		expect(
			navButton(mountConsole([makeSlide('a'), makeSlide('b')], 1), 'prev').attributes('disabled'),
		).toBeUndefined();
	});

	it('never disables Next, including on the last slide', () => {
		const next = navButton(mountConsole([makeSlide('a'), makeSlide('b')], 1), 'next');
		expect(next.exists()).toBeTruthy();
		expect(next.attributes('disabled')).toBeUndefined();
	});

	it('never disables Next on a one-slide deck either', () => {
		// The predicate that was wrong, `isLastSlide(0, 1)`, is true here.
		expect(
			navButton(mountConsole([makeSlide('a')], 0), 'next').attributes('disabled'),
		).toBeUndefined();
	});
});
