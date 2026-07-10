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
	PowerPointViewerProps,
	ViewerLoadDetail,
	ViewerTheme,
} from './viewer/types';
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
