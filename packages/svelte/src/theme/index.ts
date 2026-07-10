/**
 * Theme surface for the Svelte binding: a direct re-export of the shared,
 * framework-agnostic `ViewerTheme` system (types, defaults, CSS-variable
 * helpers, and the Vermilion presets), mirroring the Vue package.
 */
export type { ViewerTheme, ViewerThemeColors } from 'pptx-viewer-shared';
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
} from 'pptx-viewer-shared';
