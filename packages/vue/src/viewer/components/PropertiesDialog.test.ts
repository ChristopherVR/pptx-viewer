import { mount } from '@vue/test-utils';
import type { PptxCoreProperties } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import PropertiesDialog from './PropertiesDialog.vue';
import type { DocumentProperties } from './PropertiesDialog.vue';

function baseProperties(): DocumentProperties {
	return {
		title: 'Quarterly Review',
		creator: 'Ada Lovelace',
		subject: 'Finance',
		keywords: 'q4, budget',
		created: '2024-01-15T08:00:00Z',
		modified: '2024-06-01T12:30:00Z',
	};
}

describe('propertiesDialog', () => {
	it('prefills editable fields from the properties prop', () => {
		const wrapper = mount(PropertiesDialog, {
			global: { stubs: { teleport: true } },
			props: { open: true, properties: baseProperties() },
		});

		expect((wrapper.get('#pptx-vue-props-title').element as HTMLInputElement).value).toBe(
			'Quarterly Review',
		);
		expect((wrapper.get('#pptx-vue-props-creator').element as HTMLInputElement).value).toBe(
			'Ada Lovelace',
		);
		expect((wrapper.get('#pptx-vue-props-subject').element as HTMLInputElement).value).toBe(
			'Finance',
		);
		expect((wrapper.get('#pptx-vue-props-keywords').element as HTMLInputElement).value).toBe(
			'q4, budget',
		);
	});

	it('renders created/modified as read-only text (no inputs)', () => {
		const wrapper = mount(PropertiesDialog, {
			global: { stubs: { teleport: true } },
			props: { open: true, properties: baseProperties() },
		});
		// Only the four editable fields are inputs.
		expect(wrapper.findAll('input')).toHaveLength(4);
		expect(wrapper.text()).toContain('Created');
		expect(wrapper.text()).toContain('Modified');
	});

	it('emits save with only the edited fields', async () => {
		const wrapper = mount(PropertiesDialog, {
			global: { stubs: { teleport: true } },
			props: { open: true, properties: baseProperties() },
		});

		await wrapper.get('#pptx-vue-props-title').setValue('Updated Title');
		await wrapper.get('#pptx-vue-props-keywords').setValue('q4, budget, final');

		const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save');
		await saveButton!.trigger('click');

		const events = wrapper.emitted('save');
		expect(events).toHaveLength(1);
		const payload = events![0][0] as Partial<PptxCoreProperties>;
		expect(payload).toStrictEqual({
			title: 'Updated Title',
			keywords: 'q4, budget, final',
		});
	});

	it('emits close from the cancel button', async () => {
		const wrapper = mount(PropertiesDialog, {
			global: { stubs: { teleport: true } },
			props: { open: true, properties: baseProperties() },
		});
		const cancel = wrapper.findAll('button').find((b) => b.text() === 'Cancel');
		await cancel!.trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
