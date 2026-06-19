/**
 * chart-palette.ts — colour-ramp helpers for chart styling.
 *
 * `tint` (lighten toward white) and `shade` (darken toward black) are the two
 * primitive colour transforms behind the Office chart style-id palettes. The
 * full style-id → palette mapping (`getChartStylePalette`) and the default
 * fallback palette (`DEFAULT_CHART_PALETTE`) live in `chart-helpers.ts` and are
 * re-exported here so a binding can pull the whole palette surface from one
 * module.
 *
 * Extracted from the React `viewer/utils/chart-style-palettes.ts`.
 *
 * @module chart-palette
 */

export { DEFAULT_CHART_PALETTE, getChartStylePalette } from './chart-helpers';

/** Parse a hex colour string (#RRGGBB) into [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		parseInt(h.substring(0, 2), 16),
		parseInt(h.substring(2, 4), 16),
		parseInt(h.substring(4, 6), 16),
	];
}

/** Convert [r, g, b] back to #RRGGBB. */
function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
	return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g)
		.toString(16)
		.padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/**
 * Apply a tint (lighten towards white) to a colour.
 * `amount` in [0, 1] where 0 = no change, 1 = white.
 */
export function tint(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/**
 * Apply a shade (darken towards black) to a colour.
 * `amount` in [0, 1] where 0 = no change, 1 = black.
 */
export function shade(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}
