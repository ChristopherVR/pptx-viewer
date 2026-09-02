import { mount } from '@vue/test-utils';
import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import CompatibilityToasts from './CompatibilityToasts.vue';

function toast(overrides: Partial<CompatibilityWarningToast> = {}): CompatibilityWarningToast {
	return {
		id: 'SAVE_ELEMENT_SKIPPED',
		code: 'SAVE_ELEMENT_SKIPPED',
		severity: 'warning',
		messageKey: 'pptx.compatibility.saveElementSkipped',
		...overrides,
	};
}

describe('compatibilityToasts', () => {
	it('renders nothing for an empty toast list', () => {
		const wrapper = mount(CompatibilityToasts, { props: { toasts: [], overflowCount: 0 } });
		expect(wrapper.find('[data-testid="pptx-compat-toasts"]').exists()).toBeFalsy();
	});

	it('renders one toast per entry with its code and severity as data attributes', () => {
		const wrapper = mount(CompatibilityToasts, {
			props: { toasts: [toast()], overflowCount: 0 },
		});
		const el = wrapper.find('[data-testid="pptx-compat-toast"]');
		expect(el.exists()).toBeTruthy();
		expect(el.attributes('data-code')).toBe('SAVE_ELEMENT_SKIPPED');
		expect(el.attributes('data-severity')).toBe('warning');
	});

	it('emits dismiss with the toast id and dismiss-all from the header button', async () => {
		const wrapper = mount(CompatibilityToasts, {
			props: { toasts: [toast()], overflowCount: 0 },
		});
		await wrapper.find('[data-testid="pptx-compat-toast-dismiss"]').trigger('click');
		await wrapper.find('[data-testid="pptx-compat-toasts-dismiss-all"]').trigger('click');
		expect(wrapper.emitted('dismiss')?.[0]).toStrictEqual(['SAVE_ELEMENT_SKIPPED']);
		expect(wrapper.emitted('dismiss-all')).toHaveLength(1);
	});

	it('shows the overflow count when there are more toasts than fit', () => {
		const wrapper = mount(CompatibilityToasts, {
			props: { toasts: [toast()], overflowCount: 3 },
		});
		expect(wrapper.text()).toContain('+3');
	});
});
