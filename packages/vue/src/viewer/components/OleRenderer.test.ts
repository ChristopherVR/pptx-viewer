import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import OleRenderer from './OleRenderer.vue';

function ole(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'ole',
		id: 'ole 1',
		x: 10,
		y: 20,
		width: 300,
		height: 200,
		oleObjectType: 'excel',
		fileName: 'budget.xlsx',
		...overrides,
	} as PptxElement;
}

describe('oleRenderer', () => {
	it('renders the file name and type sub-label in the placeholder', () => {
		const wrapper = mount(OleRenderer, { props: { element: ole(), zIndex: 1 } });
		expect(wrapper.text()).toContain('budget.xlsx');
		expect(wrapper.text()).toContain('Excel Spreadsheet');
		// No preview image → placeholder, not <img>.
		expect(wrapper.find('img').exists()).toBeFalsy();
	});

	it('falls back to the type label when no file name is present', () => {
		const wrapper = mount(OleRenderer, {
			props: { element: ole({ fileName: undefined, oleObjectType: 'unknown' }), zIndex: 0 },
		});
		expect(wrapper.text()).toContain('Embedded Object');
	});

	it('renders the preview image with a type badge when previewImageData exists', () => {
		const src = 'data:image/png;base64,AAAA';
		const wrapper = mount(OleRenderer, {
			props: { element: ole({ previewImageData: src }), zIndex: 0 },
		});
		const img = wrapper.get('img');
		expect(img.attributes('src')).toBe(src);
		// Badge text for excel.
		expect(wrapper.text()).toContain('EXCEL');
	});
});
