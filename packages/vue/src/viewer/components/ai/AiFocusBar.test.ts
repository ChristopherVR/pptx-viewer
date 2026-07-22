import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiFocusedTarget } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import AiFocusBar from './AiFocusBar.vue';

/**
 * AiFocusBar tests: renders friendly focus chips, the crosshair pick button
 * enters pick mode, and a two-table focus surfaces a one-click merge directive.
 */
function tableSlides(): PptxSlide[] {
	return [
		{
			id: 's1',
			slideNumber: 1,
			elements: [
				{ id: 't1', type: 'table', x: 0, y: 0, width: 100, height: 50 },
				{ id: 't2', type: 'table', x: 0, y: 60, width: 100, height: 50 },
			],
		},
	] as unknown as PptxSlide[];
}

describe('aiFocusBar', () => {
	it('renders a chip per focused target and the pick affordance', () => {
		const targets: PptxAiFocusedTarget[] = [{ kind: 'slide', slideIndex: 0 }];
		const wrapper = mount(AiFocusBar, {
			props: { targets, slides: [], isPinned: false, pickMode: false, hasPicks: false },
		});
		expect(wrapper.text()).toContain('Slide 1');
		const pick = wrapper
			.findAll('button')
			.find((b) => b.attributes('aria-label') === 'Pick an element for the assistant');
		expect(pick).toBeTruthy();
	});

	it('emits start-pick when the crosshair is clicked', async () => {
		const wrapper = mount(AiFocusBar, {
			props: {
				targets: [{ kind: 'slide', slideIndex: 0 }],
				slides: [],
				isPinned: false,
				pickMode: false,
				hasPicks: false,
			},
		});
		const pick = wrapper
			.findAll('button')
			.find((b) => b.attributes('aria-label') === 'Pick an element for the assistant');
		await pick?.trigger('click');
		expect(wrapper.emitted('start-pick')).toBeTruthy();
	});

	it('surfaces a merge directive when the focus is exactly two tables', async () => {
		const targets: PptxAiFocusedTarget[] = [
			{ kind: 'element', slideIndex: 0, elementId: 't1' },
			{ kind: 'element', slideIndex: 0, elementId: 't2' },
		];
		const wrapper = mount(AiFocusBar, {
			props: { targets, slides: tableSlides(), isPinned: true, pickMode: false, hasPicks: false },
		});
		const merge = wrapper.findAll('button').find((b) => b.text().includes('Merge selected tables'));
		expect(merge).toBeTruthy();
		await merge?.trigger('click');
		const emitted = wrapper.emitted('send-directive');
		expect(emitted).toBeTruthy();
		expect(String(emitted?.[0]?.[0])).toContain('merge_tables');
	});
});
