import type { ViewerTheme, ViewerThemeColors } from './types';

/**
 * Built-in "vermilion" theme presets.
 *
 * These mirror the pptx-viewer brand used on the documentation site:
 * a warm paper canvas in light mode, a dimmed presenter room in dark
 * mode, and the vermilion accent in both. Pass one to the viewer's
 * `theme` prop (React/Vue) or `provideViewerTheme` (Angular), or spread
 * the color objects to derive your own variant.
 */

/** Light "paper" palette: a projection screen in a bright room. */
export const vermilionLightColors: ViewerThemeColors = {
	background: '#fbfaf7',
	foreground: '#1a1d21',

	card: '#ffffff',
	cardForeground: '#1a1d21',

	popover: '#ffffff',
	popoverForeground: '#1a1d21',

	primary: '#c2431f',
	primaryForeground: '#ffffff',

	secondary: '#f2efe8',
	secondaryForeground: '#1a1d21',

	muted: '#f2efe8',
	mutedForeground: '#5a626e',

	accent: 'rgba(194, 67, 31, 0.08)',
	accentForeground: '#1a1d21',

	destructive: '#dc2626',
	destructiveForeground: '#ffffff',

	border: '#e6e2d9',
	input: '#e6e2d9',
	ring: '#c2431f',
};

/** Dark "presenter" palette: the presenter room with the lights down. */
export const vermilionDarkColors: ViewerThemeColors = {
	background: '#0f1113',
	foreground: '#f0efec',

	card: '#171a1e',
	cardForeground: '#f0efec',

	popover: '#171a1e',
	popoverForeground: '#f0efec',

	primary: '#e86a40',
	primaryForeground: '#ffffff',

	secondary: '#1f242b',
	secondaryForeground: '#f0efec',

	muted: '#1f242b',
	mutedForeground: '#9aa1ab',

	accent: 'rgba(232, 106, 64, 0.1)',
	accentForeground: '#f0efec',

	destructive: '#ef4444',
	destructiveForeground: '#ffffff',

	border: '#272c33',
	input: '#272c33',
	ring: '#e86a40',
};

/** Shared border-radius for the vermilion presets (slightly sharper than the default). */
export const vermilionRadius = '0.375rem';

/** Light vermilion theme, ready for the viewer's `theme` prop. */
export const vermilionLightTheme: ViewerTheme = {
	colors: vermilionLightColors,
	radius: vermilionRadius,
};

/** Dark vermilion theme, ready for the viewer's `theme` prop. */
export const vermilionDarkTheme: ViewerTheme = {
	colors: vermilionDarkColors,
	radius: vermilionRadius,
};
