/**
 * Color handling for legacy .ppt files.
 *
 * - ColorSchemeAtom ([MS-PPT] 2.4.20 SlideSchemeColorSchemeAtom): eight
 *   scheme colors per slide/master.
 * - ColorIndexStruct ([MS-PPT] 2.12.2): text colors, either explicit RGB or
 *   an index into the scheme.
 * - OfficeArtCOLORREF ([MS-ODRAW] 2.2.2): fill/line colors from shape
 *   property tables.
 *
 * @module ppt/color-scheme
 */

import { iterateChildren } from './record-stream';
import type { PptRecord } from './record-stream';
import { RT } from './record-types';

/** Scheme slot indexes ([MS-PPT] ColorSchemeEnum). */
export const SCHEME = {
	background: 0,
	textAndLines: 1,
	shadows: 2,
	titleText: 3,
	fills: 4,
	accent1: 5,
	accent2: 6,
	accent3: 7,
} as const;

/** Eight scheme colors as lowercase hex strings without '#'. */
export type PptColorScheme = string[];

/** Fallback scheme matching PowerPoint's default template. */
export const DEFAULT_SCHEME: PptColorScheme = [
	'FFFFFF',
	'000000',
	'808080',
	'000000',
	'BBE0E3',
	'333399',
	'009999',
	'99CC00',
];

function toHex(r: number, g: number, b: number): string {
	return [r, g, b].map((v) => (v & 0xff).toString(16).padStart(2, '0').toUpperCase()).join('');
}

/**
 * Parse a ColorSchemeAtom record's data into eight hex colors.
 * Each color is a UInt32 with red in the low byte.
 */
export function parseColorSchemeAtom(view: DataView, rec: PptRecord): PptColorScheme {
	const colors: string[] = [];
	for (let i = 0; i < 8 && (i + 1) * 4 <= rec.recLen; i++) {
		const v = view.getUint32(rec.dataOffset + i * 4, true);
		colors.push(toHex(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff));
	}
	while (colors.length < 8) {
		colors.push(DEFAULT_SCHEME[colors.length]);
	}
	return colors;
}

/**
 * Find the scheme color scheme (recInstance 0x001) among a container's
 * children.
 */
export function findSchemeColors(view: DataView, container: PptRecord): PptColorScheme | undefined {
	for (const child of iterateChildren(view, container)) {
		if (child.recType === RT.ColorSchemeAtom && child.recInstance === 0x001) {
			return parseColorSchemeAtom(view, child);
		}
	}
	return undefined;
}

/**
 * Resolve a ColorIndexStruct (4 bytes: red, green, blue, index) to hex RGB.
 *
 * @returns Hex color, or undefined when the index marks the color unset.
 */
export function resolveColorIndex(
	red: number,
	green: number,
	blue: number,
	index: number,
	scheme: PptColorScheme,
): string | undefined {
	if (index === 0xfe) {
		return toHex(red, green, blue);
	}
	if (index === 0xff) {
		return undefined;
	}
	if (index < scheme.length) {
		return scheme[index & 0x07];
	}
	return toHex(red, green, blue);
}

/**
 * Resolve an OfficeArtCOLORREF (UInt32, red in low byte) to hex RGB.
 *
 * High-byte flags: 0x08 = scheme index in the low byte; 0x10 = system color
 * (approximated); palette flags are treated as plain RGB.
 */
export function resolveEscherColor(colorRef: number, scheme: PptColorScheme): string {
	const flags = (colorRef >>> 24) & 0xff;
	if (flags & 0x08) {
		return scheme[colorRef & 0x07] ?? DEFAULT_SCHEME[colorRef & 0x07];
	}
	if (flags & 0x10) {
		// System color reference; approximate common cases with scheme colors.
		const sysIndex = colorRef & 0xff;
		// 0xF0 = fill color, 0xF1 = line color per MS-ODRAW system indexes.
		if (sysIndex === 0xf0) {
			return scheme[SCHEME.fills];
		}
		return scheme[SCHEME.textAndLines];
	}
	return toHex(colorRef & 0xff, (colorRef >>> 8) & 0xff, (colorRef >>> 16) & 0xff);
}
