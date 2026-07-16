import { describe, expect, it } from 'vitest';

import {
	DEFAULT_VIEWER_PREFERENCES,
	updateViewerPreference,
	VIEWER_PREFERENCE_TOGGLES,
	VIEWER_SHORTCUT_REFERENCE,
} from './viewer-preferences';

describe('viewer preferences', () => {
	it('provides every settings toggle once', () => {
		expect(VIEWER_PREFERENCE_TOGGLES.map(({ key }) => key)).toStrictEqual([
			'autoSave',
			'spellCheck',
			'showGrid',
			'showRulers',
			'snapToGrid',
			'reducedMotion',
		]);
	});

	it('updates one preference without mutating defaults', () => {
		const result = updateViewerPreference(DEFAULT_VIEWER_PREFERENCES, 'showGrid', true);
		expect(result.showGrid).toBeTruthy();
		expect(DEFAULT_VIEWER_PREFERENCES.showGrid).toBeFalsy();
	});

	it('includes discoverable editing shortcuts', () => {
		expect(
			VIEWER_SHORTCUT_REFERENCE.some(({ shortcut }) => shortcut === 'Ctrl/Cmd+C'),
		).toBeTruthy();
		expect(VIEWER_SHORTCUT_REFERENCE.some(({ shortcut }) => shortcut === 'Escape')).toBeTruthy();
	});
});
