/**
 * table-style-entry-parse.ts - pure parse of one `<a:tblStyle>` node (and of a
 * whole `<a:tblStyleLst>`) into the structured {@link ParsedTableStyleEntry}
 * model.
 *
 * Extracted from {@link PptxHandlerRuntimeTableStyles} so that the exact same
 * assembly is used by three callers rather than being hand-copied:
 *
 *   1. the runtime mixin, parsing a deck's `ppt/tableStyles.xml`;
 *   2. the generator that produced `pptx-viewer-shared`'s built-in table-style
 *      catalogue from PowerPoint's own output;
 *   3. tests.
 *
 * The section-level fill / text / border parsing itself lives in
 * `table-style-fill-parse.ts` and `table-style-border-parse.ts`; this module
 * only walks the 13 `CT_TableStyle` parts and assembles the entry.
 *
 * @module table-style-entry-parse
 */
import type {
	ParsedTableBackground,
	ParsedTableStyleBorders,
	ParsedTableStyleEntry,
	ParsedTableStyleFill,
	ParsedTableStyleMap,
	ParsedTableStyleText,
	ParsedTableFillRef,
	PptxTableCell3D,
	XmlObject,
} from '../../types';
import {
	parseSolidFillStyle,
	parseTableStyleBorders,
	parseTableStyleSectionCell3D,
} from './table-style-border-parse';
import type { ResolveTableStyleImagePath } from './table-style-fill-parse';
import { parseTableStyleSectionFill, parseTableStyleSectionText } from './table-style-fill-parse';

/**
 * The 13 `CT_TableStyle` part names, in the sequence ECMA-376 Part 1
 * §21.1.3.14 declares them. That sequence IS the application order, lowest to
 * highest precedence, so the renderer walks this list to decide which section
 * wins. Row emphasis therefore beats column emphasis (`firstRow` after
 * `firstCol`), and the corner cells beat everything.
 */
export const TABLE_STYLE_PART_SEQUENCE = [
	'wholeTbl',
	'band1H',
	'band2H',
	'band1V',
	'band2V',
	'lastCol',
	'firstCol',
	'lastRow',
	'seCell',
	'swCell',
	'firstRow',
	'neCell',
	'nwCell',
] as const;

export type TableStylePartName = (typeof TABLE_STYLE_PART_SEQUENCE)[number];

/** Normalise a table style GUID to uppercase with braces. */
export function normalizeTableStyleGuid(guid: string): string {
	const trimmed = guid.trim().toUpperCase();
	return trimmed.startsWith('{') ? trimmed : `{${trimmed}}`;
}

/** Derive the dominant accent key from a set of table style fills. */
export function deriveTableStyleAccentKey(
	...fills: (ParsedTableStyleFill | undefined)[]
): string | undefined {
	for (const fill of fills) {
		if (fill?.schemeColor?.startsWith('accent')) {
			return fill.schemeColor;
		}
	}
	return undefined;
}

/**
 * Extract `<a:tblBg>` children: an inline fill (best-effort scheme-fill
 * resolution) plus a flag for `<a:effectLst>` so the save path can round-trip
 * the original effect XML.
 */
export function parseTableBackground(
	tblBg: XmlObject | undefined,
): ParsedTableBackground | undefined {
	if (!tblBg) {
		return undefined;
	}
	const fillNode = tblBg['a:fill'] as XmlObject | undefined;
	const solidFill = (fillNode?.['a:solidFill'] ?? tblBg['a:solidFill']) as XmlObject | undefined;
	const schemeClr = solidFill?.['a:schemeClr'] as XmlObject | undefined;
	const schemeColor = schemeClr ? String(schemeClr['@_val'] || '').trim() || undefined : undefined;
	const fill = schemeColor ? { schemeColor } : undefined;
	const hasEffectLst = Boolean(tblBg['a:effectLst']);
	// `a:fillRef` is `a:fill`'s choice sibling in CT_TableBackgroundStyle: a
	// style-matrix index (`@idx`) plus an optional colour-transform child,
	// rather than an inline fill choice. Only present when `a:fill` is not.
	const fillRefNode = fillNode ? undefined : (tblBg['a:fillRef'] as XmlObject | undefined);
	const fillRef = parseTableBackgroundFillRef(fillRefNode);
	if (!fill && !hasEffectLst && !fillRef) {
		return undefined;
	}
	return {
		...(fill ? { fill } : {}),
		...(fillRef ? { fillRef } : {}),
		...(hasEffectLst ? { hasEffectLst } : {}),
	};
}

/** Parse `a:tblBg/a:fillRef` (CT_StyleMatrixReference) into a {@link ParsedTableFillRef}. */
function parseTableBackgroundFillRef(
	fillRefNode: XmlObject | undefined,
): ParsedTableFillRef | undefined {
	if (!fillRefNode) {
		return undefined;
	}
	const idx = parseInt(String(fillRefNode['@_idx'] ?? ''), 10);
	if (!Number.isFinite(idx)) {
		return undefined;
	}
	const schemeClr = fillRefNode['a:schemeClr'] as XmlObject | undefined;
	const color = parseSolidFillStyle(fillRefNode);
	const srgb = fillRefNode['a:srgbClr'] as XmlObject | undefined;
	if (color) {
		return { idx, color };
	}
	if (!schemeClr && srgb) {
		const hex = String(srgb['@_val'] || '').trim();
		if (hex) {
			return { idx, color: { schemeColor: '', color: hex.startsWith('#') ? hex : `#${hex}` } };
		}
	}
	return { idx };
}

/** Parse a single `<a:tblStyle>` node. Returns `undefined` without a styleId. */
export function parseTableStyleEntry(
	style: XmlObject,
	resolveImagePath?: ResolveTableStyleImagePath,
): ParsedTableStyleEntry | undefined {
	const rawId = String(style['@_styleId'] || '').trim();
	if (!rawId) {
		return undefined;
	}
	const styleId = normalizeTableStyleGuid(rawId);
	const styleName = String(style['@_styleName'] || '').trim() || undefined;

	const section = (name: TableStylePartName): XmlObject | undefined =>
		style[`a:${name}`] as XmlObject | undefined;

	const fills: Partial<Record<`${TableStylePartName}Fill`, ParsedTableStyleFill>> = {};
	const textProps: Partial<Record<`${TableStylePartName}Text`, ParsedTableStyleText>> = {};
	const borderProps: Partial<Record<`${TableStylePartName}Borders`, ParsedTableStyleBorders>> = {};
	const cell3DProps: Partial<Record<`${TableStylePartName}Cell3D`, PptxTableCell3D>> = {};
	for (const name of TABLE_STYLE_PART_SEQUENCE) {
		const node = section(name);
		const fill = parseTableStyleSectionFill(node, resolveImagePath);
		if (fill) {
			fills[`${name}Fill`] = fill;
		}
		const text = parseTableStyleSectionText(node);
		if (text) {
			textProps[`${name}Text`] = text;
		}
		const tcStyle = node?.['a:tcStyle'] as XmlObject | undefined;
		const borders = parseTableStyleBorders(tcStyle);
		if (borders) {
			borderProps[`${name}Borders`] = borders;
		}
		const cell3D = parseTableStyleSectionCell3D(tcStyle);
		if (cell3D) {
			cell3DProps[`${name}Cell3D`] = cell3D;
		}
	}

	const tableBackground = parseTableBackground(style['a:tblBg'] as XmlObject | undefined);
	const accentKey = deriveTableStyleAccentKey(
		fills.wholeTblFill,
		fills.band1HFill,
		fills.band1VFill,
		fills.firstRowFill,
	);

	return {
		styleId,
		styleName,
		accentKey,
		...(tableBackground ? { tableBackground } : {}),
		...fills,
		...textProps,
		...borderProps,
		...cell3DProps,
	};
}

/**
 * Parse a whole parsed `ppt/tableStyles.xml` document into a GUID -> entry map
 * plus the list's `@def` default-style GUID.
 */
export function parseTableStyleList(
	parsed: XmlObject,
	ensureArray: (value: unknown) => XmlObject[],
	resolveImagePath?: ResolveTableStyleImagePath,
): { map: ParsedTableStyleMap; defaultStyleId?: string } | undefined {
	const styleLst = parsed['a:tblStyleLst'] as XmlObject | undefined;
	if (!styleLst) {
		return undefined;
	}
	const rawDef = String(styleLst['@_def'] || '').trim();
	const defaultStyleId = rawDef ? normalizeTableStyleGuid(rawDef) : undefined;

	const map: ParsedTableStyleMap = {};
	for (const style of ensureArray(styleLst['a:tblStyle'])) {
		const entry = parseTableStyleEntry(style, resolveImagePath);
		if (entry) {
			map[entry.styleId] = entry;
		}
	}
	if (Object.keys(map).length === 0 && !defaultStyleId) {
		return undefined;
	}
	return { map, ...(defaultStyleId ? { defaultStyleId } : {}) };
}
