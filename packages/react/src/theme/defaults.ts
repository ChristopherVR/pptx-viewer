import type { ViewerThemeColors } from "./types";

/**
 * Default dark-theme color values.
 *
 * These correspond to the built-in dark UI of the PowerPoint viewer and
 * use Tailwind's gray palette as the neutral scale with indigo as the
 * primary accent.
 */
export const defaultThemeColors: ViewerThemeColors = {
	background: "#030712", // gray-950
	foreground: "#f3f4f6", // gray-100

	card: "#111827", // gray-900
	cardForeground: "#f3f4f6", // gray-100

	popover: "#111827", // gray-900
	popoverForeground: "#f3f4f6", // gray-100

	primary: "#6366f1", // indigo-500
	primaryForeground: "#ffffff", // white

	secondary: "#1f2937", // gray-800
	secondaryForeground: "#f3f4f6", // gray-100

	muted: "#1f2937", // gray-800
	mutedForeground: "#9ca3af", // gray-400

	accent: "#1f2937", // gray-800
	accentForeground: "#f3f4f6", // gray-100

	destructive: "#ef4444", // red-500
	destructiveForeground: "#ffffff", // white

	border: "#374151", // gray-700
	input: "#374151", // gray-700
	ring: "#6366f1", // indigo-500
};

/** Default border-radius. */
export const defaultRadius = "0.5rem";
