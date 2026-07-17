import type { ViewerTheme, ViewerThemeColors } from './types';

/**
 * Default dark-theme color values.
 *
 * These correspond to the built-in dark UI of the PowerPoint viewer and
 * use Tailwind's gray palette as the neutral scale with indigo as the
 * primary accent.
 */
export const defaultThemeColors: ViewerThemeColors = {
	background: '#030712', // gray-950
	foreground: '#f3f4f6', // gray-100

	card: '#111827', // gray-900
	cardForeground: '#f3f4f6', // gray-100

	popover: '#111827', // gray-900
	popoverForeground: '#f3f4f6', // gray-100

	primary: '#6366f1', // indigo-500
	primaryForeground: '#ffffff', // white

	secondary: '#1f2937', // gray-800
	secondaryForeground: '#f3f4f6', // gray-100

	muted: '#1f2937', // gray-800
	mutedForeground: '#9ca3af', // gray-400

	accent: '#1f2937', // gray-800
	accentForeground: '#f3f4f6', // gray-100

	destructive: '#ef4444', // red-500
	destructiveForeground: '#ffffff', // white

	border: '#374151', // gray-700
	input: '#374151', // gray-700
	ring: '#6366f1', // indigo-500
};

/** Default border-radius. */
export const defaultRadius = '0.5rem';

/**
 * Built-in light-theme color values, companion to {@link defaultThemeColors}
 * (which is itself a dark palette despite the name). Pass `lightTheme` to the
 * viewer's `theme` prop to opt into a light UI without picking the vermilion brand.
 */
export const lightThemeColors: ViewerThemeColors = {
	background: '#f8fafc', // slate-50
	foreground: '#0f172a', // slate-900

	card: '#ffffff',
	cardForeground: '#0f172a', // slate-900

	popover: '#ffffff',
	popoverForeground: '#0f172a', // slate-900

	primary: '#4f46e5', // indigo-600
	primaryForeground: '#ffffff',

	secondary: '#f1f5f9', // slate-100
	secondaryForeground: '#0f172a', // slate-900

	muted: '#f1f5f9', // slate-100
	mutedForeground: '#64748b', // slate-500

	accent: '#f1f5f9', // slate-100
	accentForeground: '#0f172a', // slate-900

	destructive: '#dc2626', // red-600
	destructiveForeground: '#ffffff',

	border: '#e2e8f0', // slate-200
	input: '#e2e8f0', // slate-200
	ring: '#4f46e5', // indigo-600
};

/** Light theme, ready for the viewer's `theme` prop. */
export const lightTheme: ViewerTheme = {
	colors: lightThemeColors,
};
