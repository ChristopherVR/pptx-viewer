/** Framework-neutral viewer preferences surfaced by Settings dialogs. */
export interface ViewerPreferences {
	autoSave: boolean;
	spellCheck: boolean;
	showGrid: boolean;
	showRulers: boolean;
	snapToGrid: boolean;
	reducedMotion: boolean;
}

export type ViewerSettings = ViewerPreferences;

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
	{ actionKey: 'pptx.shortcuts.action.nudgeElement', shortcut: 'Arrow keys' },
	{ actionKey: 'pptx.shortcuts.action.nudgeElementLarge', shortcut: 'Shift+Arrow keys' },
	{ actionKey: 'pptx.shortcuts.action.zoomCanvas', shortcut: 'Ctrl/Cmd+Mouse wheel' },
	{ actionKey: 'pptx.shortcuts.action.commitTextEdit', shortcut: 'Ctrl/Cmd+Enter' },
	{ actionKey: 'pptx.shortcuts.action.cancelTextEdit', shortcut: 'Escape' },
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
