/**
 * VML color and opacity value parsing.
 *
 * Converts VML color values (named colors, `#RRGGBB`, `#RGB`,
 * `rgb(r,g,b)`) to CSS hex strings and VML opacity values
 * (fractional, percentage, fixed-point) to numbers in the 0-1 range.
 *
 * @module vml-color-parser
 */

// ── Named color map ──────────────────────────────────────────────────

/** Mapping of common VML named colors to their hex equivalents. */
const NAMED_COLORS: Record<string, string> = {
	black: '#000000',
	white: '#ffffff',
	red: '#ff0000',
	green: '#008000',
	blue: '#0000ff',
	yellow: '#ffff00',
	cyan: '#00ffff',
	magenta: '#ff00ff',
	silver: '#c0c0c0',
	gray: '#808080',
	grey: '#808080',
	maroon: '#800000',
	olive: '#808000',
	lime: '#00ff00',
	aqua: '#00ffff',
	teal: '#008080',
	navy: '#000080',
	fuchsia: '#ff00ff',
	purple: '#800080',
	orange: '#ffa500',
	window: '#ffffff',
	windowtext: '#000000',
	buttonface: '#f0f0f0',
	infobk: '#ffffe1',
};

// ── Color parsing ────────────────────────────────────────────────────

/**
 * Parse a VML color value to a CSS hex color string.
 *
 * Supports:
 * - `#RRGGBB` and `#RGB` hex notation
 * - `rgb(r,g,b)` functional notation
 * - Named colors (e.g. "black", "white", "windowtext")
 *
 * @param color - Raw VML color string.
 * @returns CSS hex color string (e.g. `"#ff0000"`), or `undefined` if
 *   the value cannot be parsed.
 */
export function parseVmlColor(color: string | undefined): string | undefined {
	if (!color) {
		return undefined;
	}
	const trimmed = color.trim().toLowerCase();
	if (trimmed.length === 0 || trimmed === 'none') {
		return undefined;
	}

	// Already hex
	if (trimmed.startsWith('#')) {
		if (trimmed.length === 4) {
			// #RGB -> #RRGGBB
			return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
		}
		return trimmed;
	}

	// rgb(r,g,b)
	const rgbMatch = trimmed.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
	if (rgbMatch) {
		const r = parseInt(rgbMatch[1], 10);
		const g = parseInt(rgbMatch[2], 10);
		const b = parseInt(rgbMatch[3], 10);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	return NAMED_COLORS[trimmed] || undefined;
}

// ── Opacity parsing ──────────────────────────────────────────────────

/**
 * Parse a VML opacity value to a number in the 0-1 range.
 *
 * VML uses three notations:
 * - Fractional: `"0.5"` (direct float)
 * - Fixed-point: `"65536f"` (where 65536 = 1.0)
 * - Percentage: `"50%"`
 *
 * @param value - Raw VML opacity string.
 * @returns Opacity as a number in [0, 1], or `undefined` if unparseable.
 */
export function parseVmlOpacity(value: string): number | undefined {
	if (!value) {
		return undefined;
	}
	const trimmed = value.trim();
	if (trimmed.endsWith('f')) {
		const fixed = parseFloat(trimmed.slice(0, -1));
		return Number.isFinite(fixed) ? fixed / 65536 : undefined;
	}
	if (trimmed.endsWith('%')) {
		const pct = parseFloat(trimmed.slice(0, -1));
		return Number.isFinite(pct) ? pct / 100 : undefined;
	}
	const num = parseFloat(trimmed);
	return Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : undefined;
}
