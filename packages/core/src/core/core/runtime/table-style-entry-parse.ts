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
	XmlObject,
} from '../../types';
import { parseTableStyleBorders } from './table-style-border-parse';
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
	if (!fill && !hasEffectLst) {
		return undefined;
	}
	return {
		...(fill ? { fill } : {}),
		...(hasEffectLst ? { hasEffectLst } : {}),
	};
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
		const borders = parseTableStyleBorders(node?.['a:tcStyle'] as XmlObject | undefined);
		if (borders) {
			borderProps[`${name}Borders`] = borders;
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
