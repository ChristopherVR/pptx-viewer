import { describe, expect, it } from 'vitest';

import type { ViewerSettings } from './viewer-settings';
import {
	DEFAULT_VIEWER_SETTINGS,
	SETTING_TOGGLES,
	SHORTCUT_REFERENCE_ITEMS,
} from './viewer-settings';

describe('viewer-settings', () => {
	it('defaults match the React dialog initial state', () => {
		expect(DEFAULT_VIEWER_SETTINGS).toStrictEqual<ViewerSettings>({
			autoSave: true,
			spellCheck: false,
			showGrid: false,
			showRulers: false,
			snapToGrid: false,
			reducedMotion: false,
		});
	});

	it('exposes a toggle spec for every settings key', () => {
		const toggleKeys = SETTING_TOGGLES.map((spec) => spec.key).sort();
		const settingKeys = Object.keys(DEFAULT_VIEWER_SETTINGS).sort();
		expect(toggleKeys).toStrictEqual(settingKeys);
	});

	it('provides keyboard shortcut reference entries', () => {
		expect(SHORTCUT_REFERENCE_ITEMS.length).toBeGreaterThan(0);
		expect(SHORTCUT_REFERENCE_ITEMS[0]).toStrictEqual({
			actionKey: 'pptx.toolbar.undo',
			shortcut: 'Ctrl/Cmd+Z',
		});
	});
});
