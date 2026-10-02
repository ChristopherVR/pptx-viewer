import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ReadOnlyBanner from './ReadOnlyBanner.vue';

/** The banner renders inside the shared element's open shadow root. */
function inner(wrapper: VueWrapper, selector: string): HTMLElement | null {
	return (wrapper.element as HTMLElement).shadowRoot?.querySelector<HTMLElement>(selector) ?? null;
}
const visible = (wrapper: VueWrapper, selector: string): boolean =>
	inner(wrapper, selector)?.hidden === false;

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
		inner(wrapper, '[data-testid="pptx-readonly-edit-anyway"]')!.click();
		inner(wrapper, '[data-testid="pptx-readonly-dismiss"]')!.click();
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
			expect(visible(wrapper, '[data-testid="pptx-readonly-password-form"]')).toBeTruthy();
			expect(visible(wrapper, '[data-testid="pptx-readonly-edit-anyway"]')).toBeFalsy();
			expect(visible(wrapper, '[data-testid="pptx-readonly-dismiss"]')).toBeFalsy();
			const input = inner(wrapper, '[data-testid="pptx-readonly-password-input"]')!;
			expect(input.getAttribute('type')).toBe('password');
			expect(input.getAttribute('aria-invalid')).toBe('false');
		});

		it('emits submit-password with the typed value when "Unlock" is clicked', async () => {
			const wrapper = mount(ReadOnlyBanner, {
				props: {
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					passwordPromptOpen: true,
				},
			});
			const input = inner(
				wrapper,
				'[data-testid="pptx-readonly-password-input"]',
			) as HTMLInputElement;
			input.value = 'secret';
			inner(wrapper, '[data-testid="pptx-readonly-password-form"]')!.dispatchEvent(
				new Event('submit', { cancelable: true }),
			);
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
			inner(wrapper, '[data-testid="pptx-readonly-password-cancel"]')!.click();
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
			const input = inner(wrapper, '[data-testid="pptx-readonly-password-input"]')!;
			expect(input.getAttribute('aria-invalid')).toBe('true');
			expect(visible(wrapper, '[data-testid="pptx-readonly-password-error"]')).toBeTruthy();
			expect(
				inner(wrapper, '[data-testid="pptx-readonly-password-error"]')!.getAttribute('role'),
			).toBe('alert');
		});
	});
});
