import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { compareSlides } from '../composables/slide-compare';
import type { CompareResult } from '../composables/slide-compare';
import type { CanvasSize } from '../types';
import ComparePanel from './ComparePanel.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function shape(id: string, x = 0): PptxElement {
	return { type: 'shape', id, x, y: 0, width: 100, height: 50 } as PptxElement;
}

function slide(id: string, elements: PptxElement[] = []): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements };
}

/** A result with one changed slide and one added slide. */
function makeResult(): CompareResult {
	return compareSlides(
		[slide('s1', [shape('a', 0)])],
		[slide('s1', [shape('a', 99)]), slide('s2')],
	);
}

function mountPanel(compareResult: CompareResult | null, open = true) {
	return mount(ComparePanel, {
		props: {
			open,
			compareResult,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
		},
		global: { stubs: { SlideStage: true } },
	});
}

describe('comparePanel', () => {
	it('renders nothing when closed or without a result', () => {
		expect(mountPanel(makeResult(), false).find('.pptx-vue-compare-panel').exists()).toBeFalsy();
		expect(mountPanel(null).find('.pptx-vue-compare-panel').exists()).toBeFalsy();
	});

	it('renders one diff row per non-trivial diff', () => {
		const wrapper = mountPanel(makeResult());
		// changed + added = 2 rows
		expect(wrapper.findAll('.pptx-vue-diff-row')).toHaveLength(2);
	});

	it('shows the summary counts', () => {
		const wrapper = mountPanel(makeResult());
		const summary = wrapper.find('.pptx-vue-compare-summary').text();
		expect(summary).toContain('1 added');
		expect(summary).toContain('1 changed');
	});

	it('emits accept-slide with the diff index', async () => {
		const wrapper = mountPanel(makeResult());
		await wrapper.findAll('.pptx-vue-diff-btn--accept')[0]!.trigger('click');
		expect(wrapper.emitted('accept-slide')).toStrictEqual([[0]]);
	});

	it('emits accept-all', async () => {
		const wrapper = mountPanel(makeResult());
		await wrapper.find('.pptx-vue-compare-accept-all').trigger('click');
		expect(wrapper.emitted('accept-all')).toHaveLength(1);
	});

	it('emits close from the header button', async () => {
		const wrapper = mountPanel(makeResult());
		await wrapper.find('.pptx-vue-compare-close').trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('shows the no-differences message for identical decks', () => {
		const result = compareSlides([slide('s1')], [slide('s1')]);
		const wrapper = mountPanel(result);
		expect(wrapper.find('.pptx-vue-compare-empty').exists()).toBeTruthy();
	});
});
