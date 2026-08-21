import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import GroupInfoPanel from './GroupInfoPanel.vue';

function group(children: PptxElement[] | undefined): PptxElement {
	return { type: 'group', id: 'g1', x: 0, y: 0, width: 100, height: 50, children } as PptxElement;
}

describe('groupInfoPanel', () => {
	it('shows the child count for a group with children', () => {
		const wrapper = mount(GroupInfoPanel, {
			props: { element: group([{ id: 'a' } as PptxElement, { id: 'b' } as PptxElement]) },
		});
		expect(wrapper.text()).toContain('2');
		expect(wrapper.text()).toContain('children');
	});

	it('falls back to a generic label when children is not an array', () => {
		const wrapper = mount(GroupInfoPanel, { props: { element: group(undefined) } });
		expect(wrapper.text()).toContain('Grouped element');
	});
});
