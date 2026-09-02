/**
 * Framework-neutral viewer preferences surfaced by Settings dialogs.
 *
 * Every field is a boolean toggle on purpose: the bindings iterate
 * `keyof ViewerPreferences` and hand each value to a `(key, boolean)` setter,
 * so the deck-authored view properties (grid spacing is a number) live on the
 * extending {@link DeckViewPreferences} instead.
 */
export interface ViewerPreferences {
	autoSave: boolean;
	spellCheck: boolean;
	showGrid: boolean;
	showRulers: boolean;
	snapToGrid: boolean;
	reducedMotion: boolean;
}

export type ViewerSettings = ViewerPreferences;

/**
 * Viewer preferences plus the `ppt/viewProps.xml` fields the round-trip in
 * {@link viewerPreferencesFromViewProperties} seeds from the deck itself. All
 * optional, so a plain {@link ViewerPreferences} is assignable.
 */
export interface DeckViewPreferences extends ViewerPreferences {
	/** `p:viewPr/p:slideViewPr/p:cSldViewPr/@snapToObjects`. */
	snapToObjects?: boolean;
	/** `p:viewPr/p:slideViewPr/p:cSldViewPr/@showGuides`. */
	showGuides?: boolean;
	/** `p:viewPr/p:gridSpacing/@cx`, in positive DrawingML (EMU) units. */
	gridSpacingCx?: number;
	/** `p:viewPr/p:gridSpacing/@cy`, in positive DrawingML (EMU) units. */
	gridSpacingCy?: number;
}

export const DEFAULT_VIEWER_PREFERENCES: ViewerPreferences = {
	autoSave: true,
	spellCheck: false,
	showGrid: false,
	showRulers: false,
	snapToGrid: false,
	reducedMotion: false,
};

export const DEFAULT_VIEWER_SETTINGS = DEFAULT_VIEWER_PREFERENCES;

export interface ShortcutReferenceItem {
	actionKey: string;
	shortcut: string;
}

export const VIEWER_SHORTCUT_REFERENCE: readonly ShortcutReferenceItem[] = [
	{ actionKey: 'pptx.toolbar.undo', shortcut: 'Ctrl/Cmd+Z' },
	{ actionKey: 'pptx.toolbar.redo', shortcut: 'Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y' },
	{ actionKey: 'pptx.shortcuts.action.copyElement', shortcut: 'Ctrl/Cmd+C' },
	{ actionKey: 'pptx.shortcuts.action.cutElement', shortcut: 'Ctrl/Cmd+X' },
	{ actionKey: 'pptx.shortcuts.action.pasteElement', shortcut: 'Ctrl/Cmd+V' },
	{ actionKey: 'pptx.shortcuts.action.duplicateElement', shortcut: 'Ctrl/Cmd+D' },
	{ actionKey: 'pptx.shortcuts.action.deleteElement', shortcut: 'Delete / Backspace' },
	{ actionKey: 'pptx.shortcuts.action.selectAll', shortcut: 'Ctrl/Cmd+A' },
	{ actionKey: 'pptx.ribbon.group', shortcut: 'Ctrl/Cmd+G' },
	{ actionKey: 'pptx.ribbon.ungroup', shortcut: 'Ctrl/Cmd+Shift+G' },
	{ actionKey: 'pptx.shortcuts.action.nudgeElement', shortcut: 'Arrow keys' },
	{ actionKey: 'pptx.shortcuts.action.nudgeElementLarge', shortcut: 'Shift+Arrow keys' },
	{ actionKey: 'pptx.shortcuts.action.prevSlide', shortcut: 'Left arrow' },
	{ actionKey: 'pptx.shortcuts.action.nextSlide', shortcut: 'Right arrow' },
	{ actionKey: 'pptx.shortcuts.action.zoomCanvas', shortcut: 'Ctrl/Cmd+Mouse wheel' },
	{ actionKey: 'pptx.shortcuts.action.commitTextEdit', shortcut: 'Ctrl/Cmd+Enter' },
	{ actionKey: 'pptx.shortcuts.action.cancelTextEdit', shortcut: 'Escape' },
	// Both of these reached the shared keymap late (Ctrl+F was hand-wired in two
	// bindings, Ctrl+/ in one), so the panel that is supposed to teach the keymap
	// was advertising neither. The help panel is the keymap's documentation: a
	// chord missing here is a chord nobody discovers.
	{ actionKey: 'pptx.findReplace.title', shortcut: 'Ctrl/Cmd+F' },
	{ actionKey: 'pptx.slideShow.fromBeginning', shortcut: 'F5' },
	{ actionKey: 'pptx.slideShow.fromCurrent', shortcut: 'Shift+F5' },
	{ actionKey: 'pptx.shortcuts.title', shortcut: '? or Ctrl/Cmd+/' },
];

export const SHORTCUT_REFERENCE_ITEMS = VIEWER_SHORTCUT_REFERENCE;

export interface ViewerPreferenceToggle {
	key: keyof ViewerPreferences;
	labelKey: string;
}

export type SettingToggleSpec = ViewerPreferenceToggle;

export const VIEWER_PREFERENCE_TOGGLES: readonly ViewerPreferenceToggle[] = [
	{ key: 'autoSave', labelKey: 'pptx.settings.autoSave' },
	{ key: 'spellCheck', labelKey: 'pptx.settings.spellCheck' },
	{ key: 'showGrid', labelKey: 'pptx.settings.showGrid' },
	{ key: 'showRulers', labelKey: 'pptx.settings.showRulers' },
	{ key: 'snapToGrid', labelKey: 'pptx.settings.snapToGrid' },
	{ key: 'reducedMotion', labelKey: 'pptx.settings.reducedMotion' },
];

export const SETTING_TOGGLES = VIEWER_PREFERENCE_TOGGLES;

export function updateViewerPreference<K extends keyof ViewerPreferences>(
	preferences: ViewerPreferences,
	key: K,
	value: ViewerPreferences[K],
): ViewerPreferences {
	return { ...preferences, [key]: value };
}

/**
 * The subset of `PptxData` this round-trip reads: `ppt/viewProps.xml`'s
 * `slideViewPr` (snap-to-grid, snap-to-objects, show-guides) and grid spacing.
 * Declared structurally, matching `pptx-viewer-core`'s `PptxData` shape,
 * rather than importing it, so a binding can pass a lighter view model.
 */
export interface ViewPropertiesSource {
	readonly viewProperties?: {
		readonly slideViewPr?: {
			readonly snapToGrid?: boolean;
			readonly snapToObjects?: boolean;
			readonly showGuides?: boolean;
		};
		readonly gridSpacing?: {
			readonly cx?: number;
			readonly cy?: number;
		};
	};
}

/**
 * Seed viewer preferences from a loaded deck's `ppt/viewProps.xml`, falling
 * back to `defaults` for anything the file didn't carry.
 *
 * `ViewerPreferences` previously always started from hard-coded defaults even
 * when the source `.pptx` explicitly authored `snapToGrid="0"` or shipped its
 * own grid spacing, so a deck's own view settings were silently discarded on
 * load. Every field is read independently (a deck can set `snapToGrid`
 * without `showGuides`, etc.), so only the fields actually present override
 * the default.
 */
export function viewerPreferencesFromViewProperties(
	data: ViewPropertiesSource,
	defaults: DeckViewPreferences,
): DeckViewPreferences {
	const slideViewPr = data.viewProperties?.slideViewPr;
	const gridSpacing = data.viewProperties?.gridSpacing;
	return {
		...defaults,
		snapToGrid: slideViewPr?.snapToGrid ?? defaults.snapToGrid,
		snapToObjects: slideViewPr?.snapToObjects ?? defaults.snapToObjects,
		showGuides: slideViewPr?.showGuides ?? defaults.showGuides,
		gridSpacingCx: gridSpacing?.cx ?? defaults.gridSpacingCx,
		gridSpacingCy: gridSpacing?.cy ?? defaults.gridSpacingCy,
	};
}

/**
 * The partial `viewProperties` shape core's `applyViewPropertiesPart` writes
 * back to `ppt/viewProps.xml` for a set of viewer preferences.
 *
 * Deliberately partial and additive: `applyViewPropertiesPart` merges onto
 * `props.rawXml` when present (see `buildViewPropertiesXml` in
 * `pptx-view-props-helpers.ts`), so this only needs to carry the fields this
 * module owns, never a full `PptxViewProperties`.
 */
export function viewPropertiesPatchFromPreferences(preferences: DeckViewPreferences): {
	slideViewPr: { snapToGrid: boolean; snapToObjects: boolean; showGuides: boolean };
	gridSpacing?: { cx: number; cy: number };
} {
	const patch: {
		slideViewPr: { snapToGrid: boolean; snapToObjects: boolean; showGuides: boolean };
		gridSpacing?: { cx: number; cy: number };
	} = {
		slideViewPr: {
			snapToGrid: preferences.snapToGrid,
			snapToObjects: preferences.snapToObjects ?? false,
			showGuides: preferences.showGuides ?? false,
		},
	};
	if (
		typeof preferences.gridSpacingCx === 'number' &&
		typeof preferences.gridSpacingCy === 'number'
	) {
		patch.gridSpacing = { cx: preferences.gridSpacingCx, cy: preferences.gridSpacingCy };
	}
	return patch;
}
