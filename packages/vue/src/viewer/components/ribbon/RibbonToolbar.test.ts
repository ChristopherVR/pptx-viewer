import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { createRibbonPropsFixture } from './ribbon-props-fixture';
import RibbonToolbar from './RibbonToolbar.vue';

/**
 * RibbonToolbar: the desktop Office-style ribbon shell. Covers the
 * `hiddenActions` gating added for issue #64: the tab bar renders the full
 * canonical `TOOLBAR_TABS` list by default and omits any tab the host lists
 * in `hiddenActions`, without disturbing the rest.
 */
describe('ribbonToolbar', () => {
	it('renders every ribbon tab by default (hiddenActions omitted)', () => {
		const wrapper = mount(RibbonToolbar, { props: createRibbonPropsFixture() });
		const tabTexts = wrapper.findAll('[role="tab"]').map((tab) => tab.text());
		for (const label of ['Home', 'Insert', 'Design', 'View']) {
			expect(tabTexts).toContain(label);
		}
	});

	/**
	 * The Home tab renders the Clipboard group and the Arrange group side by
	 * side, and Arrange used to repeat Cut / Copy / Paste. Two buttons on one
	 * tab answering to "Copy" is a tab that cannot be addressed by name, by a
	 * user reading it or by the cross-binding control inventory.
	 */
	it('offers each clipboard command exactly once on the Home tab', () => {
		const wrapper = mount(RibbonToolbar, {
			props: createRibbonPropsFixture({ toolbarSection: 'home' }),
		});
		const titles = wrapper.findAll('button').map((b) => b.attributes('title'));
		for (const command of ['Paste', 'Cut', 'Copy']) {
			expect(titles.filter((title) => title === command)).toHaveLength(1);
		}
	});

	it('omits a hidden tab from the tab bar', () => {
		const wrapper = mount(RibbonToolbar, {
			props: createRibbonPropsFixture({ hiddenActions: ['insert'] }),
		});
		const tabTexts = wrapper.findAll('[role="tab"]').map((tab) => tab.text());
		expect(tabTexts).not.toContain('Insert');
		expect(tabTexts).toContain('Home');
	});
});
