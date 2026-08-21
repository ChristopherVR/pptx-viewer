import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import OlePropertiesPanel from './OlePropertiesPanel.vue';

function ole(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'ole',
		id: 'o1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		oleObjectType: 'Excel.Sheet.12',
		isLinked: false,
		...overrides,
	} as PptxElement;
}

describe('olePropertiesPanel', () => {
	it('shows the object type and Embedded status by default', () => {
		const wrapper = mount(OlePropertiesPanel, { props: { element: ole() } });
		expect(wrapper.text()).toContain('Embedded');
	});

	it('shows Linked status for a linked object', () => {
		const wrapper = mount(OlePropertiesPanel, { props: { element: ole({ isLinked: true }) } });
		expect(wrapper.text()).toContain('Linked');
	});

	it('shows the file name when present', () => {
		const wrapper = mount(OlePropertiesPanel, {
			props: { element: ole({ fileName: 'budget.xlsx' } as Partial<PptxElement>) },
		});
		expect(wrapper.text()).toContain('budget.xlsx');
	});

	it('omits the file name row when absent', () => {
		const wrapper = mount(OlePropertiesPanel, { props: { element: ole() } });
		expect(wrapper.text()).not.toContain('File Name');
	});
});
