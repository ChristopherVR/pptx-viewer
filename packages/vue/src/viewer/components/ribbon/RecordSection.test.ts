import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import RecordSection from './RecordSection.vue';

describe('record section', () => {
	it('starts recording from the beginning or current slide', async () => {
		const onRecordFromBeginning = vi.fn();
		const onRecordFromCurrent = vi.fn();
		const wrapper = mount(RecordSection, {
			props: { onRecordFromBeginning, onRecordFromCurrent },
		});

		for (const id of ['record.record.fromBeginning', 'record.record.fromCurrent']) {
			const host = wrapper.get(`[data-ribbon-control="${id}"]`).element;
			host.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
		}

		expect(onRecordFromBeginning).toHaveBeenCalledOnce();
		expect(onRecordFromCurrent).toHaveBeenCalledOnce();
		expect(wrapper.findAll('pptx-ui-ribbon-group')).toHaveLength(4);
		expect(wrapper.findAll('pptx-ui-ribbon-command[disabled]')).toHaveLength(4);
		wrapper.unmount();
	});
});
