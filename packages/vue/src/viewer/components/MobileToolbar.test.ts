import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MobileToolbar from './MobileToolbar.vue';
import { createRibbonPropsFixture } from './ribbon/ribbon-props-fixture';

/**
 * MobileToolbar: the compact mobile top bar (menu / undo / redo / save /
 * present / share). Covers the `hiddenActions` gating added for issue #64:
 * Share/Undo/Redo each map to their own `ToolbarActionId` and hide
 * independently, mirroring desktop's `TitleBar` + `TabRowActions`.
 */
describe('mobileToolbar', () => {
	it('renders Undo, Redo, and Share by default (hiddenActions omitted)', () => {
		const wrapper = mount(MobileToolbar, { props: createRibbonPropsFixture() });
		expect(wrapper.find('[aria-label="Undo"]').exists()).toBeTruthy();
		expect(wrapper.find('[aria-label="Redo"]').exists()).toBeTruthy();
		expect(wrapper.find('[aria-label="Share"]').exists()).toBeTruthy();
	});

	it('hides Share when "share" is in hiddenActions', () => {
		const wrapper = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ hiddenActions: ['share'] }),
		});
		expect(wrapper.find('[aria-label="Share"]').exists()).toBeFalsy();
		expect(wrapper.find('[aria-label="Undo"]').exists()).toBeTruthy();
	});

	it('hides Undo and Redo independently via hiddenActions', () => {
		const undoHidden = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ hiddenActions: ['undo'] }),
		});
		expect(undoHidden.find('[aria-label="Undo"]').exists()).toBeFalsy();
		expect(undoHidden.find('[aria-label="Redo"]').exists()).toBeTruthy();

		const redoHidden = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ hiddenActions: ['redo'] }),
		});
		expect(redoHidden.find('[aria-label="Undo"]').exists()).toBeTruthy();
		expect(redoHidden.find('[aria-label="Redo"]').exists()).toBeFalsy();
	});
});
