/**
 * pptx-svelte-viewer: Svelte 5 PowerPoint viewer component.
 *
 * Public surface mirrors the Vue binding's viewer subset: the
 * `PowerPointViewer` component, its prop/event types, and the shared theme
 * system (types, defaults, CSS-variable helpers, Vermilion presets).
 */
export { PowerPointViewer } from './viewer/component';
export type {
	CanvasSize,
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	PowerPointViewerApi,
	PowerPointViewerProps,
	ViewerLoadDetail,
	ViewerTheme,
} from './viewer/types';
export type { AutosaveStatus } from './viewer/state/autosave.svelte';
// Autosave recovery helpers (shared IndexedDB store), re-exported so a host can
// offer restore-on-load. The viewer itself never auto-restores (see the
// `autosave` prop docs); matching React/Vue, recovery is a host concern.
export {
	deleteAutosaveSnapshot,
	getAutosaveSnapshot,
	listAutosaveSnapshots,
} from 'pptx-viewer-shared';
export type { AutosaveRecord } from 'pptx-viewer-shared';
export {
	defaultCssVars,
	defaultRadius,
	defaultThemeColors,
	themeToCssVars,
	vermilionDarkColors,
	vermilionDarkTheme,
	vermilionLightColors,
	vermilionLightTheme,
	vermilionRadius,
} from './theme';
export type { ViewerThemeColors } from './theme';
export { registerTranslations } from './i18n';
export type { TranslationDictionary, Translator } from './i18n';
