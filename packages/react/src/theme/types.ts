/**
 * Theme configuration types for the PowerPoint viewer.
 *
 * All color values accept any valid CSS color string:
 * hex (`#6366f1`), rgb (`rgb(99 102 241)`), hsl (`hsl(239 84% 67%)`),
 * oklch (`oklch(0.585 0.233 277)`), named colors, etc.
 */

/**
 * Semantic color tokens for the viewer UI.
 *
 * These map to CSS custom properties (`--pptx-<token>`) and drive all
 * UI component colors. The naming follows the shadcn/ui convention so
 * that Tailwind + shadcn users get a familiar experience.
 */
export interface ViewerThemeColors {
	/** Page / root background */
	background: string;
	/** Default text color */
	foreground: string;

	/** Card / panel surface */
	card: string;
	/** Text on card surfaces */
	cardForeground: string;

	/** Popover / dropdown surface */
	popover: string;
	/** Text inside popovers */
	popoverForeground: string;

	/** Primary action color (buttons, active indicators) */
	primary: string;
	/** Text on primary-colored backgrounds */
	primaryForeground: string;

	/** Secondary / subdued action color */
	secondary: string;
	/** Text on secondary backgrounds */
	secondaryForeground: string;

	/** Muted / disabled surface */
	muted: string;
	/** Text on muted surfaces (also used for secondary text) */
	mutedForeground: string;

	/** Accent / hover-highlight surface */
	accent: string;
	/** Text on accent surfaces */
	accentForeground: string;

	/** Destructive / danger action color */
	destructive: string;
	/** Text on destructive backgrounds */
	destructiveForeground: string;

	/** Default border color */
	border: string;
	/** Input field border color */
	input: string;
	/** Focus ring color */
	ring: string;
}

/**
 * Full viewer theme configuration.
 *
 * Every property is optional — unset values fall back to the built-in
 * dark theme defaults.
 */
export interface ViewerTheme {
	/** Semantic UI colors. Each key maps to a `--pptx-<key>` CSS custom property. */
	colors?: Partial<ViewerThemeColors>;

	/** Base border-radius value (e.g. `"0.5rem"`, `"8px"`). */
	radius?: string;

	/**
	 * Escape hatch: arbitrary CSS custom properties to set on the viewer
	 * root element. Keys should include the `--` prefix.
	 *
	 * @example
	 * ```ts
	 * { "--my-custom-shadow": "0 4px 12px rgba(0,0,0,0.5)" }
	 * ```
	 */
	cssVars?: Record<string, string>;
}
