/**
 * PresenterNotesRail.customshow.test.ts: the "next slide" preview must be the
 * slide the next forward press actually lands on.
 *
 * The rail called `nextPresentedSlide(slides, index)` and left the running
 * custom show out of the call, so while "Reverse" was playing the console
 * previewed the slide that comes next in the DECK. The presenter then rehearsed
 * a segue to a slide the room never saw.
 */
import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import PresenterNotesRail from './PresenterNotesRail.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

/** Notes carry the slide's identity so the preview can be read off the DOM. */
function makeSlide(n: number): PptxSlide {
	return {
		id: `s${n}`,
		rId: `rId${n}`,
		slideNumber: n,
		elements: [],
		notes: `notes-${n}`,
	} as unknown as PptxSlide;
}

const SLIDES = [makeSlide(1), makeSlide(2), makeSlide(3), makeSlide(4)];

function mountRail(currentSlideIndex: number, activeCustomShow?: { slideRIds: string[] } | null) {
	return mount(PresenterNotesRail, {
		props: {
			slides: SLIDES,
			currentSlideIndex,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			clockText: '12:00',
			elapsedText: '00:00',
			audienceOpen: false,
			activeCustomShow,
		},
		global: { stubs: { SlideStage: { props: ['slide'], template: '<i>{{ slide.notes }}</i>' } } },
	});
}

/** What the next-slide preview is actually rendering. */
function preview(wrapper: ReturnType<typeof mountRail>): string {
	return wrapper.find('[data-pptx-presenter-next-preview]').text();
}

describe('presenter next-slide preview', () => {
	it('follows the deck when no custom show is running', () => {
		expect(preview(mountRail(0))).toContain('notes-2');
	});

	it('follows the running custom show order, not the deck order', () => {
		// "Reverse": rId4, rId3, rId2. Sitting on slide 3 (rId3), the next press
		// lands on slide 2, NOT slide 4.
		const reverse = { slideRIds: ['rId4', 'rId3', 'rId2'] };
		expect(preview(mountRail(2, reverse))).toContain('notes-2');
	});

	it('skips a deck slide the running show leaves out', () => {
		// "Short Show": rId1, rId4. After slide 1 comes slide 4.
		const short = { slideRIds: ['rId1', 'rId4'] };
		expect(preview(mountRail(0, short))).toContain('notes-4');
	});

	it('shows the end-of-show message at the end of the custom show', () => {
		const short = { slideRIds: ['rId1', 'rId4'] };
		expect(preview(mountRail(3, short))).not.toContain('notes-');
	});
});
