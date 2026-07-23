/**
 * table-style-border-parse.ts — pure helpers for parsing table-style borders.
 *
 * Extracted from {@link PptxHandlerRuntimeTableStyles} so that the runtime
 * mixin stays within the file-size budget. Parses the `a:tcStyle/a:tcBdr`
 * element of a table style section (`a:wholeTbl`, `a:firstRow`, banding
 * roles, corner cells, ...) into the structured
 * {@link ParsedTableStyleBorders} model consumed by the shared renderer.
 *
 * The scheme-colour parse is shared with the section-fill path via
 * {@link parseSolidFillStyle} so colour logic is not hand-rolled twice.
 */
import type {
	ParsedTableStyleBorder,
	ParsedTableStyleBorders,
	ParsedTableStyleFill,
	XmlObject,
} from '../../types';

/** EMU per CSS pixel (96 DPI). Matches the cell-level border converter. */
const EMU_PER_PIXEL = 9525;

/** The eight `a:tcBdr` child sides, in OOXML order. */
const BORDER_SIDES = [
	'left',
	'right',
	'top',
	'bottom',
	'insideH',
	'insideV',
	'tl2br',
	'bl2tr',
] as const;

/**
 * Parse an `a:solidFill` node into a scheme-colour style fill (scheme key
 * plus optional tint/shade). Returns `undefined` when the node is absent or
 * carries no `a:schemeClr`. Shared by both the section-fill and border paths.
 */
export function parseSolidFillStyle(
	solidFill: XmlObject | undefined,
): ParsedTableStyleFill | undefined {
	if (!solidFill) {
		return undefined;
	}
	const schemeClr = solidFill['a:schemeClr'] as XmlObject | undefined;
	if (!schemeClr) {
		return undefined;
	}
	const schemeColor = String(schemeClr['@_val'] || '').trim() || undefined;
	if (!schemeColor) {
		return undefined;
	}
	const tintRaw = schemeClr['a:tint'] as XmlObject | undefined;
	const tint = tintRaw ? parseInt(String(tintRaw['@_val'] || '0'), 10) || undefined : undefined;
	const shadeRaw = schemeClr['a:shade'] as XmlObject | undefined;
	const shade = shadeRaw ? parseInt(String(shadeRaw['@_val'] || '0'), 10) || undefined : undefined;
	return { schemeColor, tint, shade };
}

/** Parse a single `a:tcBdr` side (`a:left`, `a:top`, ...) into a border. */
function parseBorderSide(side: XmlObject | undefined): ParsedTableStyleBorder | undefined {
	if (!side) {
		return undefined;
	}
	// The side wraps either an `a:ln` (concrete line) or an `a:lnRef` (theme
	// style-matrix reference). We can only resolve the concrete line here.
	const ln = side['a:ln'] as XmlObject | undefined;
	if (!ln) {
		return undefined;
	}

	const border: ParsedTableStyleBorder = {};
	let has = false;

	if (ln['a:noFill'] !== undefined) {
		border.noFill = true;
		has = true;
	}

	const widthEmu = parseInt(String(ln['@_w'] || '0'), 10);
	if (widthEmu > 0) {
		border.width = Math.max(1, Math.round(widthEmu / EMU_PER_PIXEL));
		has = true;
	}

	const prstDash = ln['a:prstDash'] as XmlObject | undefined;
	const dashVal = prstDash ? String(prstDash['@_val'] || '').trim() : '';
	if (dashVal) {
		border.dash = dashVal;
		has = true;
	}

	const solidFill = ln['a:solidFill'] as XmlObject | undefined;
	const fill = parseSolidFillStyle(solidFill);
	if (fill) {
		border.fill = fill;
		has = true;
	} else {
		const srgb = solidFill?.['a:srgbClr'] as XmlObject | undefined;
		const hex = srgb ? String(srgb['@_val'] || '').trim() : '';
		if (hex) {
			border.color = hex.startsWith('#') ? hex : `#${hex}`;
			has = true;
		}
	}

	return has ? border : undefined;
}

/**
 * Parse the `a:tcBdr` child of a table style section's `a:tcStyle` into the
 * structured {@link ParsedTableStyleBorders} model. Returns `undefined` when
 * the section defines no borders.
 */
export function parseTableStyleBorders(
	tcStyle: XmlObject | undefined,
): ParsedTableStyleBorders | undefined {
	const tcBdr = tcStyle?.['a:tcBdr'] as XmlObject | undefined;
	if (!tcBdr) {
		return undefined;
	}
	const result: ParsedTableStyleBorders = {};
	let has = false;
	for (const name of BORDER_SIDES) {
		const border = parseBorderSide(tcBdr[`a:${name}`] as XmlObject | undefined);
		if (border) {
			result[name] = border;
			has = true;
		}
	}
	return has ? result : undefined;
}
