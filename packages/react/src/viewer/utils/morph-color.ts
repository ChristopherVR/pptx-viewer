/**
 * Colour parsing and interpolation utilities for morph transitions.
 *
 * Provides functions to parse hex colour strings into RGBA components,
 * linearly interpolate between two colours, and convert RGBA back to hex.
 *
 * @module utils/morph-color
 */
import type { RgbaColor } from './morph-types';

// ---------------------------------------------------------------------------
// Colour parsing and interpolation
// ---------------------------------------------------------------------------

/**
 * Parse a hex colour string (3, 4, 6, or 8 digits) into RGBA components.
 * Returns null for invalid or missing inputs.
 *
 * @param hex - A CSS hex colour string, optionally prefixed with `#`.
 * @returns Parsed RGBA components or null if the input is invalid.
 */
export function parseHexColor(hex: string | undefined): RgbaColor | null {
	if (!hex || typeof hex !== 'string') {
		return null;
	}
	let cleaned = hex.replace(/^#/, '');

	// Expand shorthand: #RGB -> #RRGGBB, #RGBA -> #RRGGBBAA
	if (cleaned.length === 3) {
		cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
	} else if (cleaned.length === 4) {
		cleaned =
			cleaned[0] +
			cleaned[0] +
			cleaned[1] +
			cleaned[1] +
			cleaned[2] +
			cleaned[2] +
			cleaned[3] +
			cleaned[3];
	}

	if (cleaned.length !== 6 && cleaned.length !== 8) {
		return null;
	}

	const r = Number.parseInt(cleaned.slice(0, 2), 16);
	const g = Number.parseInt(cleaned.slice(2, 4), 16);
	const b = Number.parseInt(cleaned.slice(4, 6), 16);
	const a = cleaned.length === 8 ? Number.parseInt(cleaned.slice(6, 8), 16) / 255 : 1;

	if ([r, g, b].some((v) => Number.isNaN(v))) {
		return null;
	}

	return { r, g, b, a: Number.isNaN(a) ? 1 : a };
}

/**
 * Linearly interpolate between two RGBA colours at parameter t (0-1).
 * Returns a CSS rgba() string.
 *
 * @param from - The starting colour.
 * @param to - The ending colour.
 * @param t - Interpolation parameter, clamped to [0, 1].
 * @returns A CSS `rgba(r, g, b, a)` string.
 */
export function lerpColor(from: RgbaColor, to: RgbaColor, t: number): string {
	const clamped = Math.max(0, Math.min(1, t));
	const r = Math.round(from.r + (to.r - from.r) * clamped);
	const g = Math.round(from.g + (to.g - from.g) * clamped);
	const b = Math.round(from.b + (to.b - from.b) * clamped);
	const a = Number((from.a + (to.a - from.a) * clamped).toFixed(3));
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Convert an RgbaColor back to a hex string (6-digit or 8-digit if alpha < 1).
 *
 * @param c - The RGBA colour to convert.
 * @returns A hex colour string prefixed with `#`.
 */
export function rgbaToHex(c: RgbaColor): string {
	const r = c.r.toString(16).padStart(2, '0');
	const g = c.g.toString(16).padStart(2, '0');
	const b = c.b.toString(16).padStart(2, '0');
	if (c.a < 1) {
		const a = Math.round(c.a * 255)
			.toString(16)
			.padStart(2, '0');
		return `#${r}${g}${b}${a}`;
	}
	return `#${r}${g}${b}`;
}
