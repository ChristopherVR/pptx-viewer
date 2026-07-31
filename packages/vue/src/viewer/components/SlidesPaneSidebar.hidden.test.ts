import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { HIDDEN_SLIDE_SLASH_GRADIENT } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import SlideSorter from './SlideSorter.vue';
import SlidesPaneSidebar from './SlidesPaneSidebar.vue';

/**
 * The hidden-slide cue in the Vue rail and slide sorter.
 *
 * Both keep LISTING a hidden slide on purpose (hiding only removes it from the
 * show). The rail dimmed it and showed an eye-off glyph; the sorter's dim rule
 * was dead (nothing ever set `is-hidden`). Neither said anything to assistive
 * tech. These pin all three shared signals, including that the accessible name
 * is untouched: the e2e suite matches "Go to slide {{n}}" exactly.
 */
function slide(id: string, hidden = false): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements: [], hidden } as unknown as PptxSlide;
}

const canvasSize = { width: 960, height: 540 };
const slides = [slide('a'), slide('b', true), slide('c')];

describe('slidesPaneSidebar hidden-slide cue', () => {
	function rail() {
		return mount(SlidesPaneSidebar, {
			props: { slides, activeIndex: 0, canvasSize, mediaDataUrls: new Map(), canEdit: true },
		});
	}

	it('lists every slide and marks only the hidden one', () => {
		const rows = rail().findAll('[aria-label^="Go to slide "]');
		expect(rows).toHaveLength(3);
		expect(rows[1].attributes('data-pptx-slide-hidden')).toBe('true');
		expect(rows[0].attributes('data-pptx-slide-hidden')).toBeUndefined();
	});

	it('slashes the slide number, so the cue is not carried by dimming alone', () => {
		const wrapper = rail();
		const rows = wrapper.findAll('[aria-label^="Go to slide "]');
		expect(rows[1].find('span').attributes('style')).toContain('linear-gradient');
		expect(HIDDEN_SLIDE_SLASH_GRADIENT).toContain('linear-gradient');
		expect(rows[0].find('span').attributes('style')).toBeUndefined();
	});

	it('describes the state without changing the accessible name', () => {
		const wrapper = rail();
		const row = wrapper.findAll('[aria-label^="Go to slide "]')[1];
		expect(row.attributes('aria-label')).toBe('Go to slide 2');
		expect(row.attributes('aria-describedby')).toBe('pptx-hidden-slide-rail-1');
		expect(wrapper.find('#pptx-hidden-slide-rail-1').text()).toContain('Hidden');
	});

	it('leaves a visible slide undescribed', () => {
		const rows = rail().findAll('[aria-label^="Go to slide "]');
		expect(rows[0].attributes('aria-describedby')).toBeUndefined();
	});
});

describe('slideSorter hidden-slide cue', () => {
	function sorter() {
		return mount(SlideSorter, {
			props: { slides, canvasSize, mediaDataUrls: new Map(), activeIndex: 0, canEdit: true },
		});
	}

	it('marks and dims the hidden tile (the is-hidden rule was previously dead)', () => {
		const tiles = sorter().findAll('.pptx-vue-sorter-tile');
		expect(tiles[1].attributes('data-pptx-slide-hidden')).toBe('true');
		expect(tiles[1].classes()).toContain('is-hidden');
		expect(tiles[0].classes()).not.toContain('is-hidden');
	});

	it('describes the hidden tile from the sorter id space', () => {
		const wrapper = sorter();
		const tiles = wrapper.findAll('.pptx-vue-sorter-tile');
		expect(tiles[1].attributes('aria-describedby')).toBe('pptx-hidden-slide-sorter-1');
		expect(wrapper.find('#pptx-hidden-slide-sorter-1').text()).toBe('Hidden');
	});
});
