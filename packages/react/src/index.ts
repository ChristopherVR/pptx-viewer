// ── React-based PowerPoint viewer/editor ──
export { PowerPointViewer, getAnimationInitialStyle } from './viewer/PowerPointViewer';
export type { PowerPointViewerProps, PowerPointViewerHandle } from './viewer/PowerPointViewer';

// ── Shared API types ──
export type { ViewerMode, PowerPointViewerAPI } from 'pptx-viewer-shared';

// ── Toolbar visibility (hiddenActions) ──
export type { ToolbarActionId, ToolbarButtonId, ToolbarTabId } from 'pptx-viewer-shared';

// ── Canvas export (html2canvas oklch wrapper) ──
export { renderToCanvas } from './lib/canvas-export';

// ── Theme configuration ──
export type { ViewerTheme, ViewerThemeColors, ThemeCatalogEntry } from './theme';
export {
	defaultThemeColors,
	defaultRadius,
	themeToCssVars,
	defaultCssVars,
	ViewerThemeProvider,
	useViewerTheme,
	vermilionLightColors,
	vermilionDarkColors,
	vermilionLightTheme,
	vermilionDarkTheme,
	vermilionRadius,
	THEME_CATALOG,
	resolveThemeCatalogEntry,
} from './theme';

// ── Locale catalog (File > Options > Language) ──
export { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';
export type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';

// ── Viewer preferences & account (File > Options / File > Account) ──
export {
	VIEWER_PREFS_STORAGE_KEY,
	readStoredViewerPrefs,
	writeStoredViewerPrefs,
	clearStoredViewerPrefs,
	DEFAULT_VIEWER_PROFILE,
	AVATAR_COLOR_SWATCHES,
	resolveProfileInitial,
	getLocalStorageUsageSummary,
	clearAllLocalViewerData,
	saveViewerProfile,
} from 'pptx-viewer-shared';
export type {
	StoredViewerPrefs,
	ViewerProfile,
	AccountAuthConfig,
	LocalStorageUsageSummary,
} from 'pptx-viewer-shared';
