// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { createViewerOptionsStore } from '../options/viewer-options-store';
import { createCustomizationController } from './customization-controller';
import { mergeCustomization } from './customization-merge';

describe('mergeCustomization', () => {
	it('merges sections field by field and replaces lists', () => {
		expect(
			mergeCustomization(
				{ ribbon: { hiddenTabs: ['draw'], hiddenButtons: ['share'] }, hiddenPanels: ['notes'] },
				{ ribbon: { hiddenTabs: ['help'] }, hiddenPanels: ['statusBar'] },
			),
		).toStrictEqual({
			ribbon: { hiddenTabs: ['help'], hiddenButtons: ['share'] },
			hiddenPanels: ['statusBar'],
		});
	});
});

describe('createCustomizationController', () => {
	it('notifies subscribers and exposes the resolved view', () => {
		const controller = createCustomizationController();
		let calls = 0;
		const stop = controller.subscribe(() => calls++);
		controller.api.hideRibbonTab('draw');
		controller.api.hideRibbonTab('draw');
		expect(controller.getResolved().hiddenActions.has('draw')).toBeTruthy();
		expect(controller.api.getCustomization().ribbon?.hiddenTabs).toStrictEqual(['draw']);
		controller.api.showRibbonTab('draw');
		expect(controller.getResolved().hiddenActions.has('draw')).toBeFalsy();
		stop();
		controller.api.hideRibbonTab('help');
		expect(calls).toBe(3);
	});

	it('covers every helper family', () => {
		const { api, getResolved } = createCustomizationController({ hiddenPanels: ['notes'] });
		api.hideToolbarButton('share');
		api.hideOptionsPage('trust');
		api.hideOptionsSection('general.startup');
		api.hideSetting('general.userInitials');
		api.lockSetting('general.userName', 'Kiosk', true);
		api.setSettingDefault('advanced.showGrid', true);
		api.hideBackstagePage('account');
		api.hideBackstageCard('gif');
		api.hideContextMenuCommand('delete');
		api.hideCanvasContextMenuCommand('ruler');
		api.disableShortcut('undo');
		api.remapShortcut('duplicate', 'Mod+Shift+D');
		api.setPanelVisible('statusBar', false);
		api.setPanelVisible('notes', true);
		api.setFeatureEnabled('ai', false);
		api.setDialogAvailable('print', false);
		const r = getResolved();
		expect(r.hiddenActions.has('share')).toBeTruthy();
		expect(r.hiddenOptionsPages.has('trust')).toBeTruthy();
		expect(r.hiddenSettings.has('general.userName')).toBeTruthy();
		expect(r.lockedSettings['general.userName']).toBe('Kiosk');
		expect(r.defaultSettings['advanced.showGrid']).toBeTruthy();
		expect(r.hiddenBackstagePages.has('print')).toBeTruthy();
		expect(r.hiddenCanvasCommands.has('ruler')).toBeTruthy();
		expect(r.keyboard.disabled.has('undo')).toBeTruthy();
		expect(r.keyboard.remap.has('duplicate')).toBeTruthy();
		expect([...r.hiddenPanels]).toStrictEqual(['statusBar']);
		expect(r.disabledFeatures.has('ai')).toBeTruthy();
		api.unlockSetting('general.userName');
		api.remapShortcut('duplicate', undefined);
		expect(getResolved().keyboard.remap.has('duplicate')).toBeFalsy();
		expect(getResolved().lockedSettings).toStrictEqual({});
		api.resetCustomization();
		expect(api.getCustomization()).toStrictEqual({});
	});
});

describe('options store constraints', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('forces locked values in and ignores writes to them', () => {
		const store = createViewerOptionsStore();
		store.setConstraints({ locked: { 'general.userName': 'Kiosk' } });
		expect(store.getOptions().general.userName).toBe('Kiosk');
		store.setValue('general', 'userName', 'Mallory');
		expect(store.getOptions().general.userName).toBe('Kiosk');
		store.reset();
		expect(store.getOptions().general.userName).toBe('Kiosk');
		expect(store.isLocked('general', 'userName')).toBeTruthy();
	});

	it('applies host defaults without persisting them, and reset returns to them', () => {
		const store = createViewerOptionsStore();
		store.setConstraints({ defaults: { 'advanced.showGrid': true } });
		expect(store.getOptions().advanced.showGrid).toBeTruthy();
		const persisted = JSON.stringify(localStorage);
		expect(persisted).not.toContain('showGrid');
		store.setValue('advanced', 'showGrid', false);
		store.reset('advanced');
		expect(store.getOptions().advanced.showGrid).toBeTruthy();
	});

	it('never overrides a value the user saved in an earlier session', () => {
		const first = createViewerOptionsStore();
		first.setValue('advanced', 'showGrid', true);
		const second = createViewerOptionsStore();
		second.setConstraints({
			defaults: { 'advanced.showGrid': false, 'advanced.snapToGrid': true },
		});
		expect(second.getOptions().advanced.showGrid).toBeTruthy();
		expect(second.getOptions().advanced.snapToGrid).toBeTruthy();
	});
});
