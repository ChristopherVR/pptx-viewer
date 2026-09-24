import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';

import {
	ViewerCustomizationState,
	effectiveHiddenActions,
	useCustomizationConstraints,
} from './viewer-customization.svelte';
import { ViewerOptionsState } from './viewer-options.svelte';

/**
 * The Svelte wrapper around the shared customisation controller: reactive
 * `resolved`, the hidden-action merge, and the options-store constraints.
 */
describe('viewerCustomizationState', () => {
	it('mirrors imperative edits into the reactive resolved view', () => {
		const state = new ViewerCustomizationState({ hiddenPanels: ['notes'] });
		expect(state.isPanelVisible('notes')).toBeFalsy();
		state.api.setPanelVisible('notes', true);
		expect(state.isPanelVisible('notes')).toBeTruthy();
		state.api.setDialogAvailable('print', false);
		expect(state.isDialogAvailable('print')).toBeFalsy();
		state.api.setFeatureEnabled('ai', false);
		expect(state.isFeatureEnabled('ai')).toBeFalsy();
		state.destroy();
	});

	it('unions the legacy prop, the customisation and Customize Ribbon', () => {
		const state = new ViewerCustomizationState({ ribbon: { hiddenTabs: ['draw'] } });
		expect(effectiveHiddenActions(state.resolved, ['share'], ['view']).sort()).toStrictEqual([
			'draw',
			'share',
			'view',
		]);
		state.destroy();
	});

	it('pushes locks and host defaults into the options store', () => {
		const customization = new ViewerCustomizationState({
			options: { locked: { 'general.userName': 'Host User' } },
		});
		const options = new ViewerOptionsState({ persist: false });
		const cleanupRoot = $effect.root(() => {
			useCustomizationConstraints(customization, options);
		});
		flushSync();
		expect(options.options.general.userName).toBe('Host User');
		expect(options.isLocked('general', 'userName')).toBeTruthy();
		// A user write to a locked setting is ignored by the store.
		options.setValue('general', 'userName', 'Someone else');
		expect(options.options.general.userName).toBe('Host User');

		customization.api.unlockSetting('general.userName');
		customization.api.lockSetting('advanced.showGrid', true);
		flushSync();
		expect(options.isLocked('general', 'userName')).toBeFalsy();
		expect(options.isLocked('advanced', 'showGrid')).toBeTruthy();
		expect(options.options.advanced.showGrid).toBeTruthy();
		cleanupRoot();
		customization.destroy();
		options.dispose();
	});
});
