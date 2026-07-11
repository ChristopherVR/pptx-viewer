import type { ViewerTheme } from 'pptx-viewer-shared';
import { vermilionDarkTheme, vermilionLightTheme } from 'pptx-viewer-shared';

/**
 * The Design tab's theme-preset gallery: swaps the viewer chrome's
 * `ViewerTheme` (light/dark "vermilion", see `pptx-viewer-shared/theme/presets.ts`),
 * not PowerPoint's own deck colour-scheme/design-theme system (that machinery
 * exists in `pptx-viewer-core` as `THEME_PRESETS` / `applyThemeToData` but is a
 * separate, much larger surface this tab intentionally does not build; see the
 * vanilla binding's Design tab for the same scoping note). `theme: undefined`
 * resets to the viewer's built-in default.
 */
export interface ThemeSwatch {
	labelKey: string;
	theme: ViewerTheme | undefined;
}

export const THEME_SWATCHES: readonly ThemeSwatch[] = [
	{ labelKey: 'pptx.ribbon.theme.default', theme: undefined },
	{ labelKey: 'pptx.ribbon.theme.light', theme: vermilionLightTheme },
	{ labelKey: 'pptx.ribbon.theme.dark', theme: vermilionDarkTheme },
];
