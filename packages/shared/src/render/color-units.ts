/**
 * Colour-unit conversion helpers shared across the SVG `<filter>` builders in
 * `render/`.
 *
 * `hexToRgbUnit` used to exist as three private, byte-identical copies:
 * `visual-effects.ts` (DAG duotone filter), `image-effects.ts` (image duotone
 * filter), and Angular's `duotone-filter.ts`. This is the one canonical copy;
 * the other two shared modules now import it instead of redefining it.
 */

/**
 * Parse a hex colour (`#RRGGBB`/`RRGGBB`, `#` optional) to normalised 0-1 RGB
 * components. Any channel that fails to parse (missing/invalid hex digits,
 * including a short 3-digit `#RGB` shorthand, which this does NOT expand)
 * produces `0`, matching every prior copy's behaviour exactly.
 */
export function hexToRgbUnit(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace(/^#/u, '');
	const r = Number.parseInt(clean.substring(0, 2), 16) / 255;
	const g = Number.parseInt(clean.substring(2, 4), 16) / 255;
	const b = Number.parseInt(clean.substring(4, 6), 16) / 255;
	return {
		r: Number.isFinite(r) ? r : 0,
		g: Number.isFinite(g) ? g : 0,
		b: Number.isFinite(b) ? b : 0,
	};
}
