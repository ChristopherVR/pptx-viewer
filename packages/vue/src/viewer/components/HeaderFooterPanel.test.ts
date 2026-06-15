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

	it('emits update with the toggled footer flag', async () => {
		const wrapper = mount(HeaderFooterPanel, {
			props: { headerFooter: { hasFooter: false } },
		});
		await wrapper.get('[data-testid="hf-footer"]').setValue(true);
		const events = wrapper.emitted('update');
		expect(events).toHaveLength(1);
		expect((events![0][0] as PptxHeaderFooter).hasFooter).toBeTruthy();
	});

	it('emits update preserving other fields when footer text changes', async () => {
		const wrapper = mount(HeaderFooterPanel, {
			props: { headerFooter: { hasFooter: true, hasSlideNumber: true, footerText: '' } },
		});
		await wrapper.get('[data-testid="hf-footer-text"]').setValue('Draft');
		const events = wrapper.emitted('update');
		expect(events).toHaveLength(1);
		const next = events![0][0] as PptxHeaderFooter;
		expect(next.footerText).toBe('Draft');
		expect(next.hasSlideNumber).toBeTruthy();
	});

	it('hides the footer-text field when footer is disabled', () => {
		const wrapper = mount(HeaderFooterPanel, {
			props: { headerFooter: { hasFooter: false } },
		});
		expect(wrapper.find('[data-testid="hf-footer-text"]').exists()).toBeFalsy();
	});

	it('emits the date auto toggle and emits update', async () => {
		const wrapper = mount(HeaderFooterPanel, {
			props: { headerFooter: { hasDateTime: true, dateTimeAuto: false } },
		});
		await wrapper.get('[data-testid="hf-date-auto"]').setValue(true);
		const events = wrapper.emitted('update');
		expect(events).toHaveLength(1);
		expect((events![0][0] as PptxHeaderFooter).dateTimeAuto).toBeTruthy();
	});

	it('emits close when the close button is clicked', async () => {
		const wrapper = mount(HeaderFooterPanel, { props: { headerFooter: {} } });
		await wrapper.get('[data-testid="header-footer-close"]').trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
