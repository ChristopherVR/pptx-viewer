import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import MobileMenuSheet from './MobileMenuSheet.vue';
import MobileToolbar from './MobileToolbar.vue';
import { createRibbonPropsFixture } from './ribbon/ribbon-props-fixture';

/**
 * MobileToolbar: the compact mobile top bar (menu / undo / redo / save /
 * present / share). Covers the `hiddenActions` gating added for issue #64:
 * Share/Undo/Redo each map to their own `ToolbarActionId` and hide
 * independently, mirroring desktop's `TitleBar` + `TabRowActions`. Also covers
 * the mobile AI entry point: with `aiEnabled` the Sparkles toggle must sit
 * directly in the top bar (not buried inside the menu sheet) so the assistant
 * is reachable on a phone in one tap.
 */
const AI_TOGGLE = 'button[aria-label="Toggle AI assistant"]';

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

	it('renders the AI toggle directly in the top bar (outside the menu sheet) when aiEnabled', () => {
		const wrapper = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ aiEnabled: true, mode: 'edit' }),
		});
		expect(wrapper.find(AI_TOGGLE).exists()).toBeTruthy();
		// One tap must reach it: it must NOT live inside the collapsed menu sheet.
		expect(wrapper.findComponent(MobileMenuSheet).find(AI_TOGGLE).exists()).toBeFalsy();
	});

	it('omits the AI toggle when the host has not enabled AI', () => {
		const wrapper = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ aiEnabled: false }),
		});
		expect(wrapper.find(AI_TOGGLE).exists()).toBeFalsy();
	});

	it('routes an AI toggle tap to onToggleAiPanel', async () => {
		const onToggleAiPanel = vi.fn();
		const wrapper = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ aiEnabled: true, onToggleAiPanel }),
		});
		await wrapper.find(AI_TOGGLE).trigger('click');
		expect(onToggleAiPanel).toHaveBeenCalledOnce();
	});
});
