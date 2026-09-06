/**
 * Colour encoding helpers for the legacy `.ppt` writer.
 *
 * Every colour is written as a literal (non-scheme-indexed) value: an
 * `OfficeArtCOLORREF` with flags = 0 for shape fills/lines, or a
 * `ColorIndexStruct` with index = 0xFE (explicit RGB) for text runs. This
 * sidesteps needing to reproduce the exact 8-slot scheme the source deck
 * used; `resolveEscherColor` / `resolveColorIndex` (the importer's read
 * side) both already special-case these literal forms, so round-tripping
 * through our own importer, and through real PowerPoint, is unaffected.
 *
 * @module ppt/writer/colors
 */

const DEFAULT_RGB = '000000';

/** Parse a '#'-optional hex RGB string into [r, g, b], defaulting to black. */
function parseHex(rgb: string | undefined): [number, number, number] {
	const hex = (rgb ?? DEFAULT_RGB).replace(/^#/u, '');
	if (!/^[0-9a-fA-F]{6}$/u.test(hex)) {
		return [0, 0, 0];
	}
	return [
		parseInt(hex.slice(0, 2), 16),
		parseInt(hex.slice(2, 4), 16),
		parseInt(hex.slice(4, 6), 16),
	];
}

/**
 * Encode a hex RGB string as a literal `OfficeArtCOLORREF` (UInt32, red in
 * the low byte, flags byte 0).
 */
export function encodeColorRef(rgb: string | undefined): number {
	const [r, g, b] = parseHex(rgb);
	return (r | (g << 8) | (b << 16)) >>> 0;
}

/**
 * Encode a hex RGB string as a literal `ColorIndexStruct` (4 bytes: red,
 * green, blue, index = 0xFE for "explicit RGB").
 */
export function encodeColorIndex(rgb: string | undefined): [number, number, number, number] {
	const [r, g, b] = parseHex(rgb);
	return [r, g, b, 0xfe];
}
