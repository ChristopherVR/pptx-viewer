import { describe, expect, it } from 'vitest';

import { toggleViewerSetting } from './settings-dialog.component';

describe('toggleViewerSetting', () => {
	it('updates one preference without mutating the current settings', () => {
		const current = {
			autoSave: true,
			spellCheck: false,
			showGrid: false,
			showRulers: false,
			snapToGrid: false,
			reducedMotion: false,
		};

		const next = toggleViewerSetting(current, 'showGrid');

		expect(next.showGrid).toBeTruthy();
		expect(next.autoSave).toBeTruthy();
		expect(current.showGrid).toBeFalsy();
	});
});
