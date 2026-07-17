import { lightTheme } from './defaults';
import { vermilionDarkTheme, vermilionLightTheme } from './presets';
import type { ViewerTheme } from './types';

/** One selectable entry in the viewer chrome's built-in theme picker (File > Options > Appearance). */
export interface ThemeCatalogEntry {
	/** Stable identifier persisted to storage and passed to `onThemeChange`. */
	key: string;
	/** `pptx.*` translation key for the entry's display label. */
	labelKey: string;
	/** The theme to apply, or `undefined` to reset to the built-in default. */
	theme: ViewerTheme | undefined;
}

/**
 * Built-in theme choices offered by File > Options > Appearance when a host
 * doesn't supply its own `availableThemes`. Keep this list short: it's meant
 * as a sensible out-of-the-box picker, not a full theme gallery. Hosts that
 * want more (or fewer) choices pass their own `availableThemes` prop.
 */
export const THEME_CATALOG: readonly ThemeCatalogEntry[] = [
	{ key: 'default', labelKey: 'pptx.settings.theme.default', theme: undefined },
	{ key: 'light', labelKey: 'pptx.settings.theme.light', theme: lightTheme },
	{
		key: 'vermilionLight',
		labelKey: 'pptx.settings.theme.vermilionLight',
		theme: vermilionLightTheme,
	},
	{
		key: 'vermilionDark',
		labelKey: 'pptx.settings.theme.vermilionDark',
		theme: vermilionDarkTheme,
	},
];

/** Look up a catalog entry by key, falling back to `undefined` (the built-in default) if not found. */
export function resolveThemeCatalogEntry(
	key: string | undefined,
	catalog: readonly ThemeCatalogEntry[] = THEME_CATALOG,
): ViewerTheme | undefined {
	return catalog.find((entry) => entry.key === key)?.theme;
}
