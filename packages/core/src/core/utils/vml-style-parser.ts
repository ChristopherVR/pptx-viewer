/**
 * VML style attribute parsing utilities.
 *
 * Handles CSS-style dimension strings, VML `style` attribute parsing,
 * and extraction of position, size, rotation, and flip properties from
 * VML elements.
 *
 * @module vml-style-parser
 */

// ── Constants ────────────────────────────────────────────────────────

/** Pixels per EMU (English Metric Unit). */
const EMU_PER_PX = 9525;

/** Points per pixel. */
const PT_PER_PX = 0.75;

// ── CSS-style dimension parsing ──────────────────────────────────────

/**
 * Parse a CSS dimension string (e.g. "100pt", "2in", "150px", "50%")
 * and return the value in pixels.
 *
 * Percentages are resolved against `containerPx` when provided,
 * otherwise treated as 0.
 *
 * @param value - CSS dimension string to parse.
 * @param containerPx - Container size in pixels for percentage resolution.
 * @returns Value in pixels.
 */
export function parseCssDimension(value: string | undefined, containerPx?: number): number {
	if (!value) {
		return 0;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return 0;
	}

	// Try pure number (assumed px)
	const num = parseFloat(trimmed);
	if (!Number.isFinite(num)) {
		return 0;
	}

	if (trimmed.endsWith('pt')) {
		return num / PT_PER_PX;
	}
	if (trimmed.endsWith('in')) {
		return num * 96;
	}
	if (trimmed.endsWith('cm')) {
		return num * (96 / 2.54);
	}
	if (trimmed.endsWith('mm')) {
		return num * (96 / 25.4);
	}
	if (trimmed.endsWith('emu')) {
		return num / EMU_PER_PX;
	}
	if (trimmed.endsWith('%')) {
		return containerPx ? (num / 100) * containerPx : 0;
	}
	// px or unitless
	return num;
}

/**
 * Parse a VML `style` attribute into a map of CSS property name to value.
 *
 * @example
 * ```ts
 * parseVmlStyle("position:absolute;left:100pt;top:50pt")
 * // => { position: "absolute", left: "100pt", top: "50pt" }
 * ```
 *
 * @param styleAttr - Raw VML style attribute string.
 * @returns Record mapping lower-cased property names to trimmed values.
 */
export function parseVmlStyle(styleAttr: string | undefined): Record<string, string> {
	const result: Record<string, string> = {};
	if (!styleAttr) {
		return result;
	}
	const parts = styleAttr.split(';');
	for (const part of parts) {
		const colonIdx = part.indexOf(':');
		if (colonIdx === -1) {
			continue;
		}
		const key = part.slice(0, colonIdx).trim().toLowerCase();
		const val = part.slice(colonIdx + 1).trim();
		if (key.length > 0 && val.length > 0) {
			result[key] = val;
		}
	}
	return result;
}

/**
 * Extract position and size from a VML style map.
 *
 * Reads the `left`, `top`, `width`, and `height` CSS properties and
 * converts them to pixel values.
 *
 * @param styleMap - Parsed VML style map.
 * @param containerW - Container width in pixels for percentage resolution.
 * @param containerH - Container height in pixels for percentage resolution.
 * @returns Bounds object with integer pixel values.
 */
export function extractVmlBounds(
	styleMap: Record<string, string>,
	containerW?: number,
	containerH?: number,
): { x: number; y: number; width: number; height: number } {
	return {
		x: Math.round(parseCssDimension(styleMap['left'], containerW)),
		y: Math.round(parseCssDimension(styleMap['top'], containerH)),
		width: Math.round(parseCssDimension(styleMap['width'], containerW)),
		height: Math.round(parseCssDimension(styleMap['height'], containerH)),
	};
}

/**
 * Extract rotation from a VML style map.
 *
 * VML uses `rotation:<degrees>` in the CSS style attribute.
 *
 * @param styleMap - Parsed VML style map.
 * @returns Rotation in degrees, or `undefined` if not specified or zero.
 */
export function extractVmlRotation(styleMap: Record<string, string>): number | undefined {
	const rot = styleMap['rotation'];
	if (!rot) {
		return undefined;
	}
	const deg = parseFloat(rot);
	return Number.isFinite(deg) && deg !== 0 ? deg : undefined;
}

/**
 * Extract flip state from a VML style map.
 *
 * VML uses `flip:x`, `flip:y`, or `flip:xy` in the style attribute.
 *
 * @param styleMap - Parsed VML style map.
 * @returns Object indicating horizontal and/or vertical flip.
 */
export function extractVmlFlip(styleMap: Record<string, string>): {
	flipHorizontal?: boolean;
	flipVertical?: boolean;
} {
	const flip = (styleMap['flip'] || '').toLowerCase();
	return {
		flipHorizontal: flip.includes('x') || undefined,
		flipVertical: flip.includes('y') || undefined,
	};
}
