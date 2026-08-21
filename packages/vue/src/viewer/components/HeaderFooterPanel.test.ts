import { mount } from '@vue/test-utils';
import type { PptxHeaderFooter } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import HeaderFooterPanel from './HeaderFooterPanel.vue';

describe('headerFooterPanel', () => {
	it('reflects the header/footer flags in the checkboxes', () => {
		const headerFooter: PptxHeaderFooter = {
			hasDateTime: true,
			hasSlideNumber: false,
			hasFooter: true,
			footerText: 'Confidential',
		};
		const wrapper = mount(HeaderFooterPanel, { props: { headerFooter } });
		expect(
			wrapper.get<HTMLInputElement>('[data-testid="hf-date-time"]').element.checked,
		).toBeTruthy();
		expect(
			wrapper.get<HTMLInputElement>('[data-testid="hf-slide-number"]').element.checked,
		).toBeFalsy();
		expect(wrapper.get<HTMLInputElement>('[data-testid="hf-footer"]').element.checked).toBeTruthy();
		expect(wrapper.get<HTMLInputElement>('[data-testid="hf-footer-text"]').element.value).toBe(
			'Confidential',
		);
	});

	it('does not emit update or close while editing, only tracks the draft locally', async () => {
		const wrapper = mount(HeaderFooterPanel, {
			props: { headerFooter: { hasFooter: false } },
		});
		await wrapper.get('[data-testid="hf-footer"]').setValue(true);
		await wrapper.get('[data-testid="hf-footer-text"]').setValue('Draft');
		expect(wrapper.emitted('update')).toBeUndefined();
		expect(wrapper.emitted('close')).toBeUndefined();
		expect(wrapper.get<HTMLInputElement>('[data-testid="hf-footer-text"]').element.value).toBe(
			'Draft',
		);
	});

	it('emits update and close together when Apply to All is clicked', async () => {
		const wrapper = mount(HeaderFooterPanel, {
			props: { headerFooter: { hasFooter: false, hasSlideNumber: true } },
		});
		await wrapper.get('[data-testid="hf-footer"]').setValue(true);
		await wrapper.get('[data-testid="hf-footer-text"]').setValue('Draft');
		await wrapper.get('[data-testid="hf-apply-all"]').trigger('click');

		const events = wrapper.emitted('update');
		expect(events).toHaveLength(1);
		const next = events![0][0] as PptxHeaderFooter;
		expect(next.footerText).toBe('Draft');
		expect(next.hasFooter).toBeTruthy();
		expect(next.hasSlideNumber).toBeTruthy();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('emits update and close together when Apply to Current is clicked', async () => {
		const wrapper = mount(HeaderFooterPanel, {
			props: { headerFooter: { hasDateTime: true, dateTimeAuto: false } },
		});
		await wrapper.get('[data-testid="hf-date-auto"]').setValue(true);
		await wrapper.get('[data-testid="hf-apply-current"]').trigger('click');

		const events = wrapper.emitted('update');
		expect(events).toHaveLength(1);
		expect((events![0][0] as PptxHeaderFooter).dateTimeAuto).toBeTruthy();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('hides the footer-text field when footer is disabled', () => {
		const wrapper = mount(HeaderFooterPanel, {
			props: { headerFooter: { hasFooter: false } },
		});
		expect(wrapper.find('[data-testid="hf-footer-text"]').exists()).toBeFalsy();
	});

	it('re-seeds the draft from a new prop value (e.g. dialog reopened)', async () => {
		const wrapper = mount(HeaderFooterPanel, {
			props: { headerFooter: { hasFooter: false } },
		});
		await wrapper.get('[data-testid="hf-footer"]').setValue(true);
		await wrapper.setProps({ headerFooter: { hasFooter: false, footerText: 'Reset' } });
		expect(wrapper.get<HTMLInputElement>('[data-testid="hf-footer"]').element.checked).toBeFalsy();
	});

	it('emits close without update when the close button is clicked', async () => {
		const wrapper = mount(HeaderFooterPanel, { props: { headerFooter: {} } });
		await wrapper.get('[data-testid="header-footer-close"]').trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
		expect(wrapper.emitted('update')).toBeUndefined();
	});
});
