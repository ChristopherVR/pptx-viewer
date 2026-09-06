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

	describe('password prompt', () => {
		it('renders the password form instead of the two buttons when open', () => {
			const wrapper = mount(ReadOnlyBanner, {
				props: {
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					passwordPromptOpen: true,
				},
			});
			expect(wrapper.find('[data-testid="pptx-readonly-password-form"]').exists()).toBeTruthy();
			expect(wrapper.find('[data-testid="pptx-readonly-edit-anyway"]').exists()).toBeFalsy();
			expect(wrapper.find('[data-testid="pptx-readonly-dismiss"]').exists()).toBeFalsy();
			const input = wrapper.find('[data-testid="pptx-readonly-password-input"]');
			expect(input.attributes('type')).toBe('password');
			expect(input.attributes('aria-invalid')).toBe('false');
		});

		it('emits submit-password with the typed value when "Unlock" is clicked', async () => {
			const wrapper = mount(ReadOnlyBanner, {
				props: {
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					passwordPromptOpen: true,
				},
			});
			await wrapper.find('[data-testid="pptx-readonly-password-input"]').setValue('secret');
			await wrapper.find('[data-testid="pptx-readonly-unlock"]').trigger('submit');
			expect(wrapper.emitted('submit-password')).toStrictEqual([['secret']]);
		});

		it('emits cancel-password when "Cancel" is clicked', async () => {
			const wrapper = mount(ReadOnlyBanner, {
				props: {
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					passwordPromptOpen: true,
				},
			});
			await wrapper.find('[data-testid="pptx-readonly-password-cancel"]').trigger('click');
			expect(wrapper.emitted('cancel-password')).toHaveLength(1);
		});

		it('marks the input aria-invalid and shows the error text on wrong-password', () => {
			const wrapper = mount(ReadOnlyBanner, {
				props: {
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					passwordPromptOpen: true,
					passwordError: 'wrong-password',
				},
			});
			const input = wrapper.find('[data-testid="pptx-readonly-password-input"]');
			expect(input.attributes('aria-invalid')).toBe('true');
			const error = wrapper.find('[data-testid="pptx-readonly-password-error"]');
			expect(error.exists()).toBeTruthy();
			expect(error.attributes('role')).toBe('alert');
		});
	});
});
