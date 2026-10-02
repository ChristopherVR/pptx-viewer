/**
 * #397: the rail's one persistent action, Add Slide, is pinned in the flat and
 * the sectioned rail alike, and nothing else on a thumbnail is a button row.
 */
import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { UseSectionOperationsResult } from '../composables/useSectionOperations';
import type { UseSlideOperationsResult } from '../composables/useSlideOperations';
import ViewerSlideRail from './ViewerSlideRail.vue';

const slides = [0, 1].map((index) => ({
	id: `s${index + 1}`,
	rId: `rId${index + 1}`,
	slideNumber: index + 1,
	sectionId: 'sec1',
	elements: [],
})) as PptxSlide[];

function mountRail(hasSections: boolean, canEdit = true) {
	const addSlide = vi.fn();
	const sectionOps = {
		slidesBySection: ref([
			{
				section: { id: 'sec1', name: 'Intro', slideIds: ['s1', 's2'] },
				slides,
				slideIndexes: [0, 1],
			},
		]),
		addSection: vi.fn(),
		renameSection: vi.fn(),
		deleteSection: vi.fn(),
		moveSectionUp: vi.fn(),
		moveSectionDown: vi.fn(),
		toggleSectionCollapse: vi.fn(),
	} as unknown as UseSectionOperationsResult;
	const wrapper = mount(ViewerSlideRail, {
		props: {
			mergedSlides: slides,
			mergedSlideById: new Map(slides.map((slide) => [slide.id, slide])),
			activeSlideIndex: 0,
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map<string, string>(),
			canEdit,
			hasSections,
			sectionOps,
			slideOps: {
				addSlide,
				moveSlide: vi.fn(),
				duplicateSlide: vi.fn(),
				deleteSlide: vi.fn(),
			} as unknown as UseSlideOperationsResult,
			goTo: vi.fn(),
			toggleSlideHidden: vi.fn(),
			onOpenLayoutForSlide: vi.fn(),
		},
	});
	return { wrapper, addSlide };
}

describe('vue slide rail footer', () => {
	for (const hasSections of [false, true]) {
		it(`holds only Add Slide when ${hasSections ? 'sectioned' : 'flat'}`, async () => {
			const { wrapper, addSlide } = mountRail(hasSections);
			const buttons = wrapper.findAll('[data-pptx-chrome="slide-footer"] button');
			expect(buttons).toHaveLength(1);
			expect(buttons[0].text()).toBe('Add Slide');
			await buttons[0].trigger('click');
			expect(addSlide).toHaveBeenCalledOnce();
		});
	}

	it('has no footer when the deck is read-only', () => {
		const { wrapper } = mountRail(true, false);
		expect(wrapper.find('[data-pptx-chrome="slide-footer"]').exists()).toBeFalsy();
	});
});
