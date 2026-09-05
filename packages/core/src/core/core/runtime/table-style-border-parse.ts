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
import { parseOoxmlPercent } from '../../color/color-primitives';
import type {
	ParsedTableStyleBorder,
	ParsedTableStyleBorders,
	ParsedTableStyleFill,
	PptxTableCell3D,
	XmlObject,
} from '../../types';

/** EMU per CSS pixel (96 DPI). Matches the cell-level border converter. */
const EMU_PER_PIXEL = 9525;

/**
 * Parse an `a:tint`/`a:shade` `@_val` into the raw OOXML thousandths integer
 * (0-100000) {@link ParsedTableStyleFill} stores. Accepts both the
 * transitional integer form (`20000`) and the Strict-OOXML lexical
 * percentage form (`20%`); `parseOoxmlPercent` already handles both.
 */
export function parseTintShadeVal(value: unknown): number | undefined {
	const fraction = parseOoxmlPercent(value);
	return fraction === undefined || fraction === 0 ? undefined : Math.round(fraction * 100_000);
}

/**
 * The eight `a:tcBdr` child sides, in OOXML order (`CT_TableCellBorderStyle`:
 * left, right, top, bottom, insideH, insideV, tl2br, tr2bl). The anti-diagonal
 * element is `tr2bl` (confirmed against this repo's own generated schema
 * inventory); `bl2tr` never appears in real OOXML and is read only as a
 * lenient legacy alias below (issue G4: this app previously wrote/read that
 * misspelled key).
 */
const BORDER_SIDES = [
	'left',
	'right',
	'top',
	'bottom',
	'insideH',
	'insideV',
	'tl2br',
	'tr2bl',
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
	const tint = tintRaw ? parseTintShadeVal(tintRaw['@_val']) : undefined;
	const shadeRaw = schemeClr['a:shade'] as XmlObject | undefined;
	const shade = shadeRaw ? parseTintShadeVal(shadeRaw['@_val']) : undefined;
	// Omit tint/shade entirely rather than setting them to `undefined`
	// (matches the sibling `parseColorChoiceFill` in table-style-fill-parse.ts)
	// so a whole-object `toStrictEqual` comparison isn't tripped by a key that
	// is present-but-undefined versus simply absent (W3-E).
	return {
		schemeColor,
		...(tint !== undefined ? { tint } : {}),
		...(shade !== undefined ? { shade } : {}),
	};
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
		// `tr2bl` is the real element; accept a legacy `a:bl2tr` node as a
		// fallback (files this app previously wrote used that misspelled key).
		const node =
			(tcBdr[`a:${name}`] as XmlObject | undefined) ??
			(name === 'tr2bl' ? (tcBdr['a:bl2tr'] as XmlObject | undefined) : undefined);
		const border = parseBorderSide(node);
		if (border) {
			result[name] = border;
			has = true;
		}
	}
	return has ? result : undefined;
}

/**
 * Parse the `a:cell3D` child of a table style section's `a:tcStyle`
 * (CT_TableStyleCellStyle) into a {@link PptxTableCell3D}. Mirrors the XML
 * shape `applyCell3DStyle` (`table-cell-3d-helpers.ts`) reads for the
 * per-cell `a:tcPr/a:cell3D`; this is the table-STYLE-level sibling, which
 * none of PowerPoint's 74 built-in gallery styles use but a hand-authored or
 * third-party style can (issue G5).
 */
export function parseTableStyleSectionCell3D(
	tcStyle: XmlObject | undefined,
): PptxTableCell3D | undefined {
	const cell3DNode = tcStyle?.['a:cell3D'] as XmlObject | undefined;
	if (!cell3DNode) {
		return undefined;
	}

	const cell3D: PptxTableCell3D = {};
	let hasStyle = false;

	const material = String(cell3DNode['@_prstMaterial'] || '').trim();
	if (material) {
		cell3D.material = material;
		hasStyle = true;
	}

	const bevel = cell3DNode['a:bevel'] as XmlObject | undefined;
	if (bevel) {
		const bevelWidth = parseInt(String(bevel['@_w'] || '0'), 10);
		if (bevelWidth > 0) {
			cell3D.bevelWidth = Math.round(bevelWidth / EMU_PER_PIXEL);
			hasStyle = true;
		}
		const bevelHeight = parseInt(String(bevel['@_h'] || '0'), 10);
		if (bevelHeight > 0) {
			cell3D.bevelHeight = Math.round(bevelHeight / EMU_PER_PIXEL);
			hasStyle = true;
		}
		const bevelPreset = String(bevel['@_prst'] || '').trim();
		if (bevelPreset) {
			cell3D.bevelPreset = bevelPreset;
			hasStyle = true;
		}
	}

	const lightRig = cell3DNode['a:lightRig'] as XmlObject | undefined;
	if (lightRig) {
		const rig = String(lightRig['@_rig'] || '').trim();
		if (rig) {
			cell3D.lightRig = rig;
			hasStyle = true;
		}
		const dir = String(lightRig['@_dir'] || '').trim();
		if (dir) {
			cell3D.lightRigDirection = dir;
			hasStyle = true;
		}
	}

	return hasStyle ? cell3D : undefined;
}
