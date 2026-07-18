import { defaultThemeColors, defaultRadius } from './defaults';
import type { ViewerTheme, ViewerThemeColors } from './types';

/**
 * Map from camelCase ViewerThemeColors keys to kebab-case CSS custom
 * property suffixes (the part after `--pptx-`).
 */
const COLOR_KEY_TO_CSS: Record<keyof ViewerThemeColors, string> = {
	background: 'background',
	foreground: 'foreground',
	card: 'card',
	cardForeground: 'card-foreground',
	popover: 'popover',
	popoverForeground: 'popover-foreground',
	primary: 'primary',
	primaryForeground: 'primary-foreground',
	secondary: 'secondary',
	secondaryForeground: 'secondary-foreground',
	muted: 'muted',
	mutedForeground: 'muted-foreground',
	accent: 'accent',
	accentForeground: 'accent-foreground',
	destructive: 'destructive',
	destructiveForeground: 'destructive-foreground',
	border: 'border',
	input: 'input',
	ring: 'ring',
};

/**
 * Derived component tokens: CSS custom properties consumed by the binding
 * chrome (inspector accents and separators) that are sourced from the base
 * `ViewerThemeColors` rather than being standalone theme inputs. Emitting
 * them here lets `var(--pptx-inspector-*)` lookups resolve in every binding.
 */
const DERIVED_COLOR_TOKENS: ReadonlyArray<{
	source: keyof ViewerThemeColors;
	cssSuffix: string;
}> = [
	{ source: 'primary', cssSuffix: 'inspector-active' },
	{ source: 'border', cssSuffix: 'inspector-border' },
];

/**
 * Convert a `ViewerTheme` into a flat `Record<string, string>` of CSS
 * custom properties (including the `--` prefix) ready to be spread onto
 * a `style` attribute.
 *
 * Only properties that differ from the built-in defaults are emitted when
 * `omitDefaults` is true (the default).
 */
export function themeToCssVars(
	theme: ViewerTheme | undefined,
	omitDefaults = false,
): Record<string, string> {
	const vars: Record<string, string> = {};

	if (!theme) {
		return vars;
	}

	// ── Colors ───────────────────────────────────────────────────────
	const colors = theme.colors;
	if (colors) {
		for (const [key, cssSuffix] of Object.entries(COLOR_KEY_TO_CSS)) {
			const value = colors[key as keyof ViewerThemeColors];
			if (value === undefined) {
				continue;
			}
			if (omitDefaults && value === defaultThemeColors[key as keyof ViewerThemeColors]) {
				continue;
			}
			vars[`--pptx-${cssSuffix}`] = value;
			// Also set the Tailwind semantic token directly so it overrides the
			// @theme :root declaration, which cannot see vars set on a child element.
			vars[`--color-${cssSuffix}`] = value;
		}
		for (const { source, cssSuffix } of DERIVED_COLOR_TOKENS) {
			const value = colors[source];
			if (value === undefined) {
				continue;
			}
			if (omitDefaults && value === defaultThemeColors[source]) {
				continue;
			}
			vars[`--pptx-${cssSuffix}`] = value;
		}
	}

	// ── Radius ───────────────────────────────────────────────────────
	if (theme.radius !== undefined) {
		if (!omitDefaults || theme.radius !== defaultRadius) {
			vars['--pptx-radius'] = theme.radius;
			// Mirror the @theme derived tokens directly for the same reason as colors.
			const r = theme.radius;
			vars['--radius-sm'] = `calc(${r} - 4px)`;
			vars['--radius-md'] = `calc(${r} - 2px)`;
			vars['--radius-lg'] = r;
			vars['--radius-xl'] = `calc(${r} + 4px)`;
		}
	}

	// ── Escape-hatch custom properties ───────────────────────────────
	if (theme.cssVars) {
		for (const [key, value] of Object.entries(theme.cssVars)) {
			vars[key] = value;
		}
	}

	return vars;
}

/**
 * Build the complete set of CSS custom properties with all defaults.
 * Useful for generating a full fallback stylesheet.
 */
export function defaultCssVars(): Record<string, string> {
	const vars: Record<string, string> = {};

	for (const [key, cssSuffix] of Object.entries(COLOR_KEY_TO_CSS)) {
		vars[`--pptx-${cssSuffix}`] = defaultThemeColors[key as keyof ViewerThemeColors];
	}
	for (const { source, cssSuffix } of DERIVED_COLOR_TOKENS) {
		vars[`--pptx-${cssSuffix}`] = defaultThemeColors[source];
	}
	vars['--pptx-radius'] = defaultRadius;

	return vars;
}
