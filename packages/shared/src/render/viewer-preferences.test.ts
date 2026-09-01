import { describe, expect, it } from 'vitest';

import {
	DEFAULT_VIEWER_PREFERENCES,
	updateViewerPreference,
	viewerPreferencesFromViewProperties,
	viewPropertiesPatchFromPreferences,
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

	it('advertises the two chords that reached the shared keymap late', () => {
		// The panel is the keymap's own documentation, so a chord that every
		// binding now answers but the panel never lists is a chord nobody finds.
		const shortcuts = VIEWER_SHORTCUT_REFERENCE.map((entry) => entry.shortcut);
		expect(shortcuts).toContain('Ctrl/Cmd+F');
		expect(shortcuts).toContain('? or Ctrl/Cmd+/');
	});
});

describe('viewerPreferencesFromViewProperties', () => {
	it('overrides only the fields the deck actually authored', () => {
		const result = viewerPreferencesFromViewProperties(
			{ viewProperties: { slideViewPr: { snapToGrid: false } } },
			DEFAULT_VIEWER_PREFERENCES,
		);
		expect(result.snapToGrid).toBeFalsy();
		// Untouched fields keep the defaults.
		expect(result.showGuides).toBe(DEFAULT_VIEWER_PREFERENCES.showGuides);
		expect(result.autoSave).toBe(DEFAULT_VIEWER_PREFERENCES.autoSave);
	});

	it('reads snapToObjects, showGuides and grid spacing', () => {
		const result = viewerPreferencesFromViewProperties(
			{
				viewProperties: {
					slideViewPr: { snapToGrid: true, snapToObjects: true, showGuides: true },
					gridSpacing: { cx: 76200, cy: 76200 },
				},
			},
			DEFAULT_VIEWER_PREFERENCES,
		);
		expect(result.snapToGrid).toBeTruthy();
		expect(result.snapToObjects).toBeTruthy();
		expect(result.showGuides).toBeTruthy();
		expect(result.gridSpacingCx).toBe(76200);
		expect(result.gridSpacingCy).toBe(76200);
	});

	it('falls back to defaults for a deck with no viewProperties at all', () => {
		const result = viewerPreferencesFromViewProperties({}, DEFAULT_VIEWER_PREFERENCES);
		// toStrictEqual would fail here for a reason that isn't a real
		// difference: this function always writes snapToObjects/showGuides/
		// gridSpacingCx/gridSpacingCy explicitly (even as `undefined`), while
		// DEFAULT_VIEWER_PREFERENCES simply omits those optional keys.
		expect(result).toStrictEqual({
			...DEFAULT_VIEWER_PREFERENCES,
			snapToObjects: undefined,
			showGuides: undefined,
			gridSpacingCx: undefined,
			gridSpacingCy: undefined,
		});
	});
});

describe('viewPropertiesPatchFromPreferences', () => {
	it('builds the partial viewProperties patch core writes back', () => {
		const patch = viewPropertiesPatchFromPreferences({
			...DEFAULT_VIEWER_PREFERENCES,
			snapToGrid: true,
			snapToObjects: true,
			showGuides: false,
			gridSpacingCx: 76200,
			gridSpacingCy: 76200,
		});
		expect(patch).toStrictEqual({
			slideViewPr: { snapToGrid: true, snapToObjects: true, showGuides: false },
			gridSpacing: { cx: 76200, cy: 76200 },
		});
	});

	it('omits gridSpacing when not fully known', () => {
		const patch = viewPropertiesPatchFromPreferences(DEFAULT_VIEWER_PREFERENCES);
		expect(patch.gridSpacing).toBeUndefined();
		expect(patch.slideViewPr).toStrictEqual({
			snapToGrid: false,
			snapToObjects: false,
			showGuides: false,
		});
	});

	it('round-trips through both directions', () => {
		const fromFile = viewerPreferencesFromViewProperties(
			{
				viewProperties: {
					slideViewPr: { snapToGrid: true, snapToObjects: false, showGuides: true },
					gridSpacing: { cx: 100000, cy: 200000 },
				},
			},
			DEFAULT_VIEWER_PREFERENCES,
		);
		const patch = viewPropertiesPatchFromPreferences(fromFile);
		expect(patch).toStrictEqual({
			slideViewPr: { snapToGrid: true, snapToObjects: false, showGuides: true },
			gridSpacing: { cx: 100000, cy: 200000 },
		});
	});
});
