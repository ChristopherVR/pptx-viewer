/**
 * Unit conversion helpers for the headless PPTX SDK.
 *
 * The builder API accepts positions/sizes in pixels (at 96 DPI).
 * These helpers convert from common units to pixels.
 *
 * @module sdk/units
 */

/** Pixels per inch at 96 DPI (standard screen resolution). */
const PPI = 96;

/** Points per inch. */
const POINTS_PER_INCH = 72;

/** EMU per pixel at 96 DPI. */
export const EMU_PER_PIXEL = 9525;

/** EMU per inch. */
export const EMU_PER_INCH = 914400;

/** EMU per point. */
export const EMU_PER_POINT = 12700;

/** Convert inches to pixels. */
export function inches(value: number): number {
	return Math.round(value * PPI);
}

/** Convert centimetres to pixels. */
export function cm(value: number): number {
	return Math.round((value / 2.54) * PPI);
}

/** Convert millimetres to pixels. */
export function mm(value: number): number {
	return Math.round((value / 25.4) * PPI);
}

/** Convert points to pixels. */
export function pt(value: number): number {
	return Math.round((value / POINTS_PER_INCH) * PPI);
}

/** Convert EMU to pixels. */
export function emuToPixels(emu: number): number {
	return Math.round(emu / EMU_PER_PIXEL);
}

/** Convert pixels to EMU. */
export function pixelsToEmu(px: number): number {
	return Math.round(px * EMU_PER_PIXEL);
}

/** Convert inches to EMU (for PresentationOptions width/height). */
export function inchesToEmu(value: number): number {
	return Math.round(value * EMU_PER_INCH);
}

/** Convert centimetres to EMU. */
export function cmToEmu(value: number): number {
	return Math.round((value / 2.54) * EMU_PER_INCH);
}

/** Standard slide dimensions in EMU. */
export const SlideSizes = {
	/** 16:9 Widescreen (13.333 x 7.5 in) - Default for modern PowerPoint */
	WIDESCREEN_16_9: { width: 12192000, height: 6858000 },
	/** 4:3 Standard (10 x 7.5 in) - Classic PowerPoint size */
	STANDARD_4_3: { width: 9144000, height: 6858000 },
	/** 16:10 Widescreen (10 x 6.25 in) */
	WIDESCREEN_16_10: { width: 9144000, height: 5715000 },
	/** A4 landscape (11.693 x 8.268 in) */
	A4_LANDSCAPE: { width: 10692000, height: 7560937 },
	/** A4 portrait (8.268 x 11.693 in) */
	A4_PORTRAIT: { width: 7560937, height: 10692000 },
	/** US Letter landscape (11 x 8.5 in) */
	LETTER_LANDSCAPE: { width: 10058400, height: 7772400 },
	/** US Letter portrait (8.5 x 11 in) */
	LETTER_PORTRAIT: { width: 7772400, height: 10058400 },
} as const;
