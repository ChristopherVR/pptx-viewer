import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.vue';
import SelectionPane from './SelectionPane.vue';

/**
 * The Selection Pane's hide toggle must actually hide the shape.
 *
 * The element is skipped rather than painted invisibly: nothing in the DOM
 * means nothing to hit-test, focus, announce or rasterise into an export. The
 * pane keeps listing it, because the pane reads the slide model.
 */

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp_1',
		x: 10,
		y: 20,
		width: 200,
		height: 80,
		shapeType: 'roundRect',
		...overrides,
	} as PptxElement;
}

describe('hidden elements are not rendered', () => {
	it('renders a visible element', () => {
		const wrapper = mount(ElementRenderer, { props: { element: shape(), zIndex: 1 } });
		expect(wrapper.findAll('[data-element-id]')).toHaveLength(1);
	});

	it('renders nothing for a hidden element', () => {
		const wrapper = mount(ElementRenderer, {
			props: { element: shape({ hidden: true }), zIndex: 1 },
		});
		expect(wrapper.findAll('[data-element-id]')).toHaveLength(0);
		expect(wrapper.find('[data-pptx-element]').exists()).toBeFalsy();
	});

	it('drops a hidden group child but keeps its visible siblings', () => {
		const group = {
			type: 'group',
			id: 'grp_1',
			x: 0,
			y: 0,
			width: 400,
			height: 200,
			children: [shape({ id: 'child_visible' }), shape({ id: 'child_hidden', hidden: true })],
		} as unknown as PptxElement;
		const wrapper = mount(ElementRenderer, { props: { element: group, zIndex: 0 } });
		expect(wrapper.find('[data-element-id="child_visible"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-element-id="child_hidden"]').exists()).toBeFalsy();
	});

	it('brings the element back when it is un-hidden', async () => {
		const wrapper = mount(ElementRenderer, {
			props: { element: shape({ hidden: true }), zIndex: 1 },
		});
		expect(wrapper.findAll('[data-element-id]')).toHaveLength(0);
		await wrapper.setProps({ element: shape({ hidden: false }) });
		expect(wrapper.findAll('[data-element-id]')).toHaveLength(1);
	});
});

describe('the Selection Pane still lists a hidden element', () => {
	it('lists every element and marks the hidden one', () => {
		const wrapper = mount(SelectionPane, {
			props: {
				elements: [shape({ id: 'sp_1' }), shape({ id: 'sp_2', hidden: true })],
				selectedIds: [],
				canEdit: true,
			},
		});
		const toggles = wrapper.findAll('button[title="Show"], button[title="Hide"]');
		expect(toggles).toHaveLength(2);
		expect(wrapper.findAll('button[title="Show"]')).toHaveLength(1);
	});

	it('emits a selection for a hidden element clicked in the list', async () => {
		const wrapper = mount(SelectionPane, {
			props: {
				elements: [shape({ id: 'sp_1' }), shape({ id: 'sp_2', hidden: true })],
				selectedIds: [],
				canEdit: true,
			},
		});
		// Rows list top-most first, so the hidden `sp_2` leads. Its row is the
		// parent of the "Show" eye button.
		await wrapper
			.get('button[title="Show"]')
			.element.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(wrapper.emitted('select')?.[0]).toStrictEqual(['sp_2']);
	});
});
