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

		await wrapper.get('button:nth-of-type(2)').trigger('click');
		await wrapper.get('button:nth-of-type(3)').trigger('click');

		expect(onRecordFromBeginning).toHaveBeenCalledOnce();
		expect(onRecordFromCurrent).toHaveBeenCalledOnce();
	});
});
