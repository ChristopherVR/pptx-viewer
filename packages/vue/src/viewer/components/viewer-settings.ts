/**
 * Viewer settings model for the Vue Settings dialog.
 *
 * Mirrors the boolean preferences exposed by the React package's
 * `SettingsDialog.tsx` (`packages/react/src/viewer/components/SettingsDialog.tsx`):
 * autosave, spell-check, show-grid, show-rulers, snap-to-grid, reduced-motion.
 *
 * The React dialog drives these through individual props/callbacks
 * (`showGrid` + `onSetShowGrid`, etc.) with `autoSave` kept as dialog-local
 * state. The Vue port consolidates them into a single `ViewerSettings` object
 * so the dialog can take one `settings` prop and emit one `update(settings)`
 * payload, which is easier to wire into a host's reactive state.
 *
 * These are pure data (no framework imports) so the type/defaults stay
 * trivially reusable and unit-testable.
 */

/** User-tunable viewer/editor preferences surfaced by the Settings dialog. */
export interface ViewerSettings {
	/** Autosave the presentation in the background. */
	autoSave: boolean;
	/** Run the browser spell-checker over editable text. */
	spellCheck: boolean;
	/** Show the alignment grid overlay on the canvas. */
	showGrid: boolean;
	/** Show horizontal/vertical rulers around the canvas. */
	showRulers: boolean;
	/** Snap element drag/resize to the grid. */
	snapToGrid: boolean;
	/** Honour the user's reduced-motion preference (disable animations). */
	reducedMotion: boolean;
}

/** Default viewer settings: matches the React dialog's initial state. */
export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
	autoSave: true,
	spellCheck: false,
	showGrid: false,
	showRulers: false,
	snapToGrid: false,
	reducedMotion: false,
};

/** A single entry in the keyboard-shortcuts reference tab. */
export interface ShortcutReferenceItem {
	/** i18n key for the human-readable action name. */
	actionKey: string;
	/** The key combination(s) that trigger it. */
	shortcut: string;
}

/**
 * Keyboard-shortcut reference shown in the dialog's "Shortcuts" tab.
 * Ported verbatim from the React package's `SHORTCUT_REFERENCE_ITEMS`
 * (`packages/react/src/viewer/constants/toolbar.ts`).
 */
export const SHORTCUT_REFERENCE_ITEMS: ShortcutReferenceItem[] = [
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

/** A toggleable setting's metadata for rendering the General tab. */
export interface SettingToggleSpec {
	/** The `ViewerSettings` boolean key this toggle controls. */
	key: keyof ViewerSettings;
	/** i18n key for the display label. */
	labelKey: string;
}

/** Ordered list of the General-tab toggles (mirrors the React dialog order). */
export const SETTING_TOGGLES: SettingToggleSpec[] = [
	{ key: 'autoSave', labelKey: 'pptx.settings.autoSave' },
	{ key: 'spellCheck', labelKey: 'pptx.settings.spellCheck' },
	{ key: 'showGrid', labelKey: 'pptx.settings.showGrid' },
	{ key: 'showRulers', labelKey: 'pptx.settings.showRulers' },
	{ key: 'snapToGrid', labelKey: 'pptx.settings.snapToGrid' },
	{ key: 'reducedMotion', labelKey: 'pptx.settings.reducedMotion' },
];
