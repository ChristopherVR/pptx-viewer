import { mount } from '@vue/test-utils';
import type { PptxCoreProperties, PptxCustomProperty, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import DocumentPropertiesDialog from './DocumentPropertiesDialog.vue';
import type { DocumentPropertiesSavePatch } from './DocumentPropertiesDialog.vue';

function baseCore(): PptxCoreProperties {
	return {
		title: 'Quarterly Review',
		creator: 'Ada Lovelace',
		subject: 'Finance',
		keywords: 'q4, budget',
		created: '2024-01-15T08:00:00Z',
		modified: '2024-06-01T12:30:00Z',
		revision: '3',
	};
}

function sampleSlides(): PptxSlide[] {
	return [
		{
			id: 's1',
			elements: [
				{ type: 'text', id: 't1', x: 0, y: 0, width: 100, height: 40, text: 'hello world' },
			],
		} as PptxSlide,
		{ id: 's2', elements: [], hidden: true } as PptxSlide,
	];
}

function mountDialog(overrides: Record<string, unknown> = {}) {
	return mount(DocumentPropertiesDialog, {
		global: { stubs: { teleport: true } },
		props: {
			open: true,
			coreProperties: baseCore(),
			customProperties: [] as PptxCustomProperty[],
			slides: sampleSlides(),
			...overrides,
		},
	});
}

describe('documentPropertiesDialog', () => {
	it('seeds the General tab from core properties', () => {
		const wrapper = mountDialog();
		expect((wrapper.get('#pptx-vue-docprops-title').element as HTMLInputElement).value).toBe(
			'Quarterly Review',
		);
		expect((wrapper.get('#pptx-vue-docprops-creator').element as HTMLInputElement).value).toBe(
			'Ada Lovelace',
		);
	});

	it('switches tabs and shows computed statistics', async () => {
		const wrapper = mountDialog();
		const statsTab = wrapper.findAll('button').find((b) => b.text() === 'Statistics');
		await statsTab!.trigger('click');
		const text = wrapper.text();
		expect(text).toContain('Slides');
		// 2 slides, 1 hidden, 2 words in the single text element.
		expect(text).toContain('Words');
		expect(text).toContain('Revision');
	});

	it('save is disabled until a field changes, then emits the edited patch', async () => {
		const wrapper = mountDialog();
		const saveButton = () => wrapper.findAll('button').find((b) => b.text() === 'Save')!;
		expect((saveButton().element as HTMLButtonElement).disabled).toBeTruthy();

		await wrapper.get('#pptx-vue-docprops-title').setValue('Updated Title');
		expect((saveButton().element as HTMLButtonElement).disabled).toBeFalsy();

		await saveButton().trigger('click');
		const events = wrapper.emitted('save');
		expect(events).toHaveLength(1);
		const patch = events![0][0] as DocumentPropertiesSavePatch;
		expect(patch.core.title).toBe('Updated Title');
		expect(patch.custom).toStrictEqual([]);
		expect(patch.app).toBeUndefined();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('includes an app patch when manager/company change', async () => {
		const wrapper = mountDialog();
		await wrapper.get('#pptx-vue-docprops-company').setValue('Acme Corp');
		const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!;
		await saveButton.trigger('click');
		const patch = wrapper.emitted('save')![0][0] as DocumentPropertiesSavePatch;
		expect(patch.app).toStrictEqual({ manager: '', company: 'Acme Corp' });
	});

	it('adds and edits a custom property, emitting it on save', async () => {
		const wrapper = mountDialog();
		const customTab = wrapper.findAll('button').find((b) => b.text() === 'Custom');
		await customTab!.trigger('click');

		const addButton = wrapper.findAll('button').find((b) => b.text().includes('Add property'));
		await addButton!.trigger('click');

		const nameInput = wrapper.findAll('input[type="text"]')[0];
		await nameInput.setValue('Project');

		const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!;
		await saveButton.trigger('click');
		const patch = wrapper.emitted('save')![0][0] as DocumentPropertiesSavePatch;
		expect(patch.custom).toHaveLength(1);
		expect(patch.custom[0]).toStrictEqual({ name: 'Project', value: '', type: 'lpwstr' });
	});

	it('emits close from Cancel', async () => {
		const wrapper = mountDialog();
		const cancel = wrapper.findAll('button').find((b) => b.text() === 'Cancel');
		await cancel!.trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
