/**
 * Font-family options.
 *
 * The old hard-coded `THEME_COLOR_SWATCHES` (a fixed 12-hex Office default
 * palette) lived here; colour pickers now render the deck's REAL theme
 * palette via `ThemeColorSwatchGrid` (`pptx-viewer-shared`'s
 * `buildThemeColorSwatchGrid`, fed by `ThemeColorMapContext`), which follows
 * whatever theme is actually loaded instead of a fixed guess, and the
 * "Standard Colors" row now comes from `pptx-viewer-shared`'s
 * `OFFICE_COLOR_SWATCHES` so every binding shows the same set.
 */

export const FONT_FAMILY_OPTIONS: string[] = [
	'Calibri',
	'Arial',
	'Times New Roman',
	'Georgia',
	'Verdana',
	'Tahoma',
	'Trebuchet MS',
	'Segoe UI',
	'Cambria',
	'Garamond',
	'Courier New',
];
