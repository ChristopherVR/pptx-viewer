import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

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

	it('shows no action bar when there is no embedded payload', () => {
		const wrapper = mount(OleRenderer, { props: { element: ole(), zIndex: 0 } });
		expect(wrapper.find('a[download]').exists()).toBeFalsy();
		expect(wrapper.find('button').exists()).toBeFalsy();
	});

	it('renders a Download anchor with href/download from the embedded payload', () => {
		const data = 'data:application/octet-stream;base64,QUJD';
		const wrapper = mount(OleRenderer, {
			props: {
				element: ole({
					oleEmbeddedData: data,
					oleEmbeddedFileName: 'report.xlsx',
					oleEmbeddedByteSize: 1536,
					oleEmbeddedMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				}),
				zIndex: 0,
			},
		});
		const anchor = wrapper.get('a[download]');
		expect(anchor.attributes('href')).toBe(data);
		expect(anchor.attributes('download')).toBe('report.xlsx');
		expect(anchor.text()).toBe('Download');
		// Human-readable size caption.
		expect(wrapper.text()).toContain('1.5 KB');
		// A binary Office type is not browser-openable: no Open button.
		expect(wrapper.find('button').exists()).toBeFalsy();
	});

	it('offers an Open action for browser-openable embedded payloads', () => {
		const data = 'data:application/pdf;base64,JVBE';
		const wrapper = mount(OleRenderer, {
			props: {
				element: ole({
					oleObjectType: 'pdf',
					oleEmbeddedData: data,
					oleEmbeddedFileName: 'spec.pdf',
					oleEmbeddedMimeType: 'application/pdf',
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.get('a[download]').attributes('download')).toBe('spec.pdf');
		const open = wrapper.get('button');
		expect(open.text()).toBe('Open');
	});

	it('falls back to the OLE file name for the download name', () => {
		const data = 'data:application/octet-stream;base64,QUJD';
		const wrapper = mount(OleRenderer, {
			props: {
				element: ole({ oleEmbeddedData: data, fileName: 'budget.xlsx' }),
				zIndex: 0,
			},
		});
		expect(wrapper.get('a[download]').attributes('download')).toBe('budget.xlsx');
	});

	it('exposes a multi-line info title with type, name, size and application', () => {
		const wrapper = mount(OleRenderer, {
			props: {
				element: ole({
					oleEmbeddedFileName: 'report.xlsx',
					oleEmbeddedByteSize: 2048,
					oleProgId: 'Excel.Sheet.12',
				}),
				zIndex: 0,
			},
		});
		const title = wrapper.get('.pptx-vue-ole').attributes('title') ?? '';
		expect(title).toContain('Excel Spreadsheet');
		expect(title).toContain('report.xlsx');
		expect(title).toContain('2 KB');
		expect(title).toContain('Excel.Sheet.12');
	});

	it('prefers the author-assigned oleName over the file name in the placeholder and aria-label', () => {
		const wrapper = mount(OleRenderer, {
			props: { element: ole({ oleName: 'Q3 Budget' }), zIndex: 0 },
		});
		expect(wrapper.text()).toContain('Q3 Budget');
		expect(wrapper.text()).not.toContain('budget.xlsx');
		expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe(
			'Excel Spreadsheet: Q3 Budget',
		);
	});

	it('stops pointer/click interactions on the action bar from bubbling', async () => {
		const data = 'data:application/octet-stream;base64,QUJD';
		const wrapper = mount(OleRenderer, {
			props: { element: ole({ oleEmbeddedData: data }), zIndex: 0 },
		});
		const bar = wrapper.get('.pptx-vue-ole-actions');
		const event = new MouseEvent('pointerdown', { bubbles: true });
		const stop = vi.spyOn(event, 'stopPropagation');
		bar.element.dispatchEvent(event);
		expect(stop).toHaveBeenCalledOnce();
	});
});
