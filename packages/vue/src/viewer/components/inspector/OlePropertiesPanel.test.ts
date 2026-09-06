import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

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

	it('renders the current oleName in the Object Name field', () => {
		const wrapper = mount(OlePropertiesPanel, {
			props: { element: ole({ oleName: 'Q3 Budget' } as Partial<PptxElement>), canEdit: true },
		});
		const input = wrapper.find('input[type="text"]');
		expect((input.element as HTMLInputElement).value).toBe('Q3 Budget');
	});

	it('emits a trimmed oleName patch on input', async () => {
		const wrapper = mount(OlePropertiesPanel, { props: { element: ole(), canEdit: true } });
		const input = wrapper.find('input[type="text"]');
		await input.setValue('  Q3 Budget  ');
		expect(wrapper.emitted('update')).toStrictEqual([[{ oleName: 'Q3 Budget' }]]);
	});

	it('emits a clearing patch when the field is emptied', async () => {
		const wrapper = mount(OlePropertiesPanel, {
			props: { element: ole({ oleName: 'Q3 Budget' } as Partial<PptxElement>), canEdit: true },
		});
		const input = wrapper.find('input[type="text"]');
		await input.setValue('');
		expect(wrapper.emitted('update')).toStrictEqual([[{ oleName: undefined }]]);
	});

	it('disables the Object Name field when canEdit is false', () => {
		const wrapper = mount(OlePropertiesPanel, {
			props: { element: ole(), canEdit: false },
		});
		const input = wrapper.find('input[type="text"]');
		expect((input.element as HTMLInputElement).disabled).toBeTruthy();
	});

	it('disables the Object Name field when canEdit is not provided (fail-safe default)', () => {
		const wrapper = mount(OlePropertiesPanel, { props: { element: ole() } });
		const input = wrapper.find('input[type="text"]');
		expect((input.element as HTMLInputElement).disabled).toBeTruthy();
	});

	describe('edit content button/dialog', () => {
		afterEach(() => {
			document.body.innerHTML = '';
		});

		function findEditContentButton(
			wrapper: ReturnType<typeof mount>,
		): HTMLButtonElement | undefined {
			return Array.from(wrapper.element.querySelectorAll<HTMLButtonElement>('button')).find(
				(b) => b.textContent?.trim() === 'Edit content...',
			);
		}

		it('shows the "Edit content" button for an editable, embedded object', () => {
			const wrapper = mount(OlePropertiesPanel, {
				props: { element: ole(), canEdit: true },
				attachTo: document.body,
			});
			expect(findEditContentButton(wrapper)).toBeDefined();
		});

		it('hides the "Edit content" button when canEdit is false', () => {
			const wrapper = mount(OlePropertiesPanel, {
				props: { element: ole(), canEdit: false },
				attachTo: document.body,
			});
			expect(findEditContentButton(wrapper)).toBeUndefined();
		});

		it('hides the "Edit content" button for a linked (not embedded) object', () => {
			const wrapper = mount(OlePropertiesPanel, {
				props: { element: ole({ isLinked: true } as Partial<PptxElement>), canEdit: true },
				attachTo: document.body,
			});
			expect(findEditContentButton(wrapper)).toBeUndefined();
		});

		it('opens the OLE editor dialog when "Edit content" is clicked', async () => {
			const wrapper = mount(OlePropertiesPanel, {
				props: { element: ole(), canEdit: true },
				attachTo: document.body,
			});
			expect(document.body.querySelector('[role="dialog"]')).toBeNull();
			findEditContentButton(wrapper)?.click();
			await wrapper.vm.$nextTick();
			expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
		});
	});
});
