import { beforeEach, describe, expect, it } from 'vitest';

import { VIEWER_OPTIONS_TABS } from '../internal/shared';
import { resolveOptionsTab } from './settings-dialog.component';
import { ViewerOptionsService } from './viewer-options.service';

describe('resolveOptionsTab', () => {
	it('resolves every category id to its definition', () => {
		for (const tab of VIEWER_OPTIONS_TABS) {
			expect(resolveOptionsTab(tab.id).id).toBe(tab.id);
		}
	});
});

describe('viewerOptionsService', () => {
	beforeEach(() => localStorage.clear());

	it('applies a value and reflects it in the reactive snapshot', () => {
		const service = new ViewerOptionsService();
		expect(service.options().advanced.showGrid).toBeFalsy();
		service.setValue('advanced', 'showGrid', true);
		expect(service.options().advanced.showGrid).toBeTruthy();
	});

	it('never hides the File tab and resets a group to defaults', () => {
		const service = new ViewerOptionsService();
		service.setRibbonTabHidden('file', true);
		service.setRibbonTabHidden('review', true);
		expect(service.options().ribbon.hiddenTabIds).toStrictEqual(['review']);
		service.reset('ribbon');
		expect(service.options().ribbon.hiddenTabIds).toStrictEqual([]);
	});

	it('persists changes across service instances', () => {
		new ViewerOptionsService().setValue('advanced', 'maximumUndoSteps', 42);
		expect(new ViewerOptionsService().options().advanced.maximumUndoSteps).toBe(42);
	});
});
