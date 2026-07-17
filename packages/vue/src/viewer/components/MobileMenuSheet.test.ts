import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MobileMenuSheet from './MobileMenuSheet.vue';
import { createRibbonPropsFixture } from './ribbon/ribbon-props-fixture';

function mountSheet(overrides: Parameters<typeof createRibbonPropsFixture>[0] = {}) {
	return mount(MobileMenuSheet, {
		props: { ...createRibbonPropsFixture(overrides), open: true },
	});
}

/**
 * MobileMenuSheet: the mobile section drawer. Covers the `hiddenActions`
 * gating added for issue #64: the section chips omit any ribbon tab the host
 * hides (mirroring the desktop tab bar), while non-tab chips ('text',
 * 'arrange', which have no ToolbarActionId) always stay.
 */
describe('mobileMenuSheet', () => {
	it('renders every section chip by default (hiddenActions omitted)', () => {
		const wrapper = mountSheet();
		const chipLabels = wrapper.findAll('button').map((btn) => btn.text());
		expect(chipLabels.some((text) => text.includes('Insert'))).toBeTruthy();
		expect(chipLabels.some((text) => text.includes('Slide Show'))).toBeTruthy();
	});

	it('omits a hidden ribbon-tab chip', () => {
		const wrapper = mountSheet({ hiddenActions: ['insert'] });
		const chipLabels = wrapper.findAll('button').map((btn) => btn.text());
		expect(chipLabels.some((text) => text.includes('Insert'))).toBeFalsy();
		expect(chipLabels.some((text) => text.includes('Home'))).toBeTruthy();
	});

	it('keeps non-tab chips ("text"/"arrange") regardless of hiddenActions', () => {
		const wrapper = mountSheet({
			hiddenActions: [
				'insert',
				'design',
				'transitions',
				'animations',
				'slideShow',
				'review',
				'view',
			],
		});
		const chipLabels = wrapper.findAll('button').map((btn) => btn.text());
		expect(chipLabels.some((text) => text.includes('Text'))).toBeTruthy();
		expect(chipLabels.some((text) => text.includes('Arrange'))).toBeTruthy();
	});
});
