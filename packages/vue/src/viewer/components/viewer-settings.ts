/**
 * Compatibility barrel for the framework-neutral viewer preferences model.
 * The source of truth lives in pptx-viewer-shared so every binding presents
 * the same settings and keyboard shortcut reference.
 */
export {
	DEFAULT_VIEWER_SETTINGS,
	SETTING_TOGGLES,
	SHORTCUT_REFERENCE_ITEMS,
} from 'pptx-viewer-shared';
export type { SettingToggleSpec, ShortcutReferenceItem, ViewerSettings } from 'pptx-viewer-shared';
