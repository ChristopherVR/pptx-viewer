import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ReadOnlyBanner from './ReadOnlyBanner.vue';

describe('readOnlyBanner', () => {
	it('renders nothing for a null kind', () => {
		const wrapper = mount(ReadOnlyBanner, { props: { kind: null, messageKey: '' } });
		expect(wrapper.find('[data-testid="pptx-readonly-banner"]').exists()).toBeFalsy();
	});

	it('renders the banner with its kind and message for a modifyVerifier deck', () => {
		const wrapper = mount(ReadOnlyBanner, {
			props: { kind: 'modifyVerifier', messageKey: 'pptx.readOnly.modifyVerifierRecommended' },
		});
		const banner = wrapper.find('[data-testid="pptx-readonly-banner"]');
		expect(banner.exists()).toBeTruthy();
		expect(banner.attributes('data-kind')).toBe('modifyVerifier');
	});

	it('emits edit-anyway and dismiss from their respective buttons', async () => {
		const wrapper = mount(ReadOnlyBanner, {
			props: { kind: 'markedFinal', messageKey: 'pptx.readOnly.markedFinal' },
		});
		await wrapper.find('[data-testid="pptx-readonly-edit-anyway"]').trigger('click');
		await wrapper.find('[data-testid="pptx-readonly-dismiss"]').trigger('click');
		expect(wrapper.emitted('edit-anyway')).toHaveLength(1);
		expect(wrapper.emitted('dismiss')).toHaveLength(1);
	});
});
