import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import TabRowActions from './TabRowActions.vue';

/**
 * TabRowActions: the ribbon tab row's Record + Share buttons. Covers the
 * `hiddenActions` gating added for issue #64 (host-controlled toolbar
 * visibility): each button maps to its own `ToolbarActionId` ('record',
 * 'share') and can be hidden independently.
 */
describe('tabRowActions', () => {
	it('renders Record and Share by default (hiddenActions omitted)', () => {
		const wrapper = mount(TabRowActions, {
			props: { onEnterRehearsalMode: () => {} },
		});
		expect(wrapper.find('[aria-label="Record"]').exists()).toBeTruthy();
		expect(wrapper.find('[aria-label="Share"]').exists()).toBeTruthy();
	});

	it('hides the Share button when "share" is in hiddenActions', () => {
		const wrapper = mount(TabRowActions, {
			props: { onEnterRehearsalMode: () => {}, hiddenActions: ['share'] },
		});
		expect(wrapper.find('[aria-label="Share"]').exists()).toBeFalsy();
		expect(wrapper.find('[aria-label="Record"]').exists()).toBeTruthy();
	});

	it('hides the Record button when "record" is in hiddenActions', () => {
		const wrapper = mount(TabRowActions, {
			props: { onEnterRehearsalMode: () => {}, hiddenActions: ['record'] },
		});
		expect(wrapper.find('[aria-label="Record"]').exists()).toBeFalsy();
		expect(wrapper.find('[aria-label="Share"]').exists()).toBeTruthy();
	});
});
