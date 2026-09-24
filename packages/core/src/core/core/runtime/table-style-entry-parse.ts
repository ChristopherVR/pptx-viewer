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
import { applyDrawingColorTransforms } from '../../color';
import type {
	ParsedTableBackground,
	ParsedTableStyleBorders,
	ParsedTableStyleEntry,
	ParsedTableStyleFill,
	ParsedTableStyleGradientStop,
	ParsedTableStyleMap,
	ParsedTableStyleText,
	ParsedTableFillRef,
	PptxTableCell3D,
	PptxThemeFillStyle,
	PptxThemeFormatScheme,
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
 *
 * When `a:tblBg` uses the `a:fillRef` (style-matrix) form instead of an
 * inline `a:fill` (e.g. "Themed Style 1/2"), `formatScheme`/`colorMap`
 * (the theme's already-resolved format scheme and colour map, both plain
 * data so this stays a pure function) let the reference be resolved into a
 * concrete {@link ParsedTableStyleFill} up front, so the renderer does not
 * need theme access of its own to show the table's background (issue: a
 * `tblBg` fillRef was captured for round-trip but never rendered, leaving
 * "Themed Style 2" tables invisible against the slide background).
 */
export function parseTableBackground(
	tblBg: XmlObject | undefined,
	formatScheme?: PptxThemeFormatScheme,
	colorMap?: Record<string, string>,
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
	const resolvedFill =
		fill ?? (fillRef ? resolveTableBackgroundFillRef(fillRef, formatScheme, colorMap) : undefined);
	if (!resolvedFill && !hasEffectLst && !fillRef) {
		return undefined;
	}
	return {
		...(resolvedFill ? { fill: resolvedFill } : {}),
		...(fillRef ? { fillRef } : {}),
		...(hasEffectLst ? { hasEffectLst } : {}),
	};
}

/**
 * Resolve a `CT_StyleMatrixReference` (`a:tblBg/a:fillRef`, the same
 * construct a shape's `p:style/a:fillRef` uses) into a concrete
 * {@link ParsedTableStyleFill}, substituting the ref's own colour child for
 * every `phClr` (placeholder colour) token the theme's format-scheme fill
 * definition carries. `idx` semantics per ECMA-376 20.1.4.2.20:
 * 0/1000 -> no fill, 1-3 -> `fillStyleLst[idx-1]`, 1001-1003 ->
 * `bgFillStyleLst[idx-1001]`.
 *
 * Stays a pure function over plain data (the theme's format scheme + a
 * scheme-key -> hex colour map) rather than the runtime instance methods the
 * shape-level `resolveThemeFillRef` uses, since table styles are parsed once
 * for the whole deck, ahead of any specific shape/theme-override context.
 * Only the `solid` and `gradient` format-scheme fill kinds are handled
 * (`pattern`/`none`/`group` are not realistic `tblBg` targets in practice).
 */
export function resolveTableBackgroundFillRef(
	fillRef: ParsedTableFillRef,
	formatScheme: PptxThemeFormatScheme | undefined,
	colorMap: Record<string, string> | undefined,
): ParsedTableStyleFill | undefined {
	if (fillRef.idx === 0 || fillRef.idx === 1000) {
		return { schemeColor: '', noFill: true };
	}
	if (!formatScheme) {
		return undefined;
	}
	const fillDef: PptxThemeFillStyle | undefined =
		fillRef.idx >= 1001
			? formatScheme.backgroundFillStyles[fillRef.idx - 1001]
			: formatScheme.fillStyles[fillRef.idx - 1];
	if (!fillDef) {
		return undefined;
	}

	const overrideKey = fillRef.color?.schemeColor;
	const overrideBase = overrideKey && colorMap ? colorMap[overrideKey] : undefined;

	if (fillDef.kind === 'gradient' && fillDef.rawNode) {
		const gradient = resolveFormatSchemeGradient(fillDef.rawNode as XmlObject, overrideBase);
		if (gradient) {
			return { schemeColor: '', gradient };
		}
	}

	if (overrideBase && fillDef.rawNode) {
		const schemeClr = (fillDef.rawNode as XmlObject)['a:schemeClr'] as XmlObject | undefined;
		const resolved = schemeClr
			? applyDrawingColorTransforms(overrideBase, schemeClr)
			: overrideBase;
		return { schemeColor: '', color: resolved };
	}

	return fillDef.color ? { schemeColor: '', color: fillDef.color } : undefined;
}

/**
 * Resolve a format-scheme `a:gradFill` (`phClr`-templated) against an
 * override base colour into a concrete {@link ParsedTableStyleFill}'s
 * gradient shape. Returns `undefined` when the gradient has no resolvable
 * stops (no override colour supplied, or every stop's colour is unresolvable
 * without one, since format-scheme gradients are always `phClr`-based).
 */
function resolveFormatSchemeGradient(
	gradNode: XmlObject,
	overrideBase: string | undefined,
):
	| { stops: ParsedTableStyleGradientStop[]; angle?: number; type: 'linear' | 'radial' }
	| undefined {
	if (!overrideBase) {
		return undefined;
	}
	const gsLst = gradNode['a:gsLst'] as XmlObject | undefined;
	const rawStops = gsLst?.['a:gs'];
	const gsNodes = (Array.isArray(rawStops) ? rawStops : rawStops ? [rawStops] : []) as XmlObject[];
	const stops: ParsedTableStyleGradientStop[] = [];
	for (const gs of gsNodes) {
		const schemeClr = gs['a:schemeClr'] as XmlObject | undefined;
		const color = schemeClr ? applyDrawingColorTransforms(overrideBase, schemeClr) : undefined;
		if (!color) {
			continue;
		}
		const position = (parseInt(String(gs['@_pos'] || '0'), 10) || 0) / 1000;
		stops.push({ position, fill: { schemeColor: '', color } });
	}
	if (stops.length === 0) {
		return undefined;
	}
	const lin = gradNode['a:lin'] as XmlObject | undefined;
	if (lin) {
		const angRaw = parseInt(String(lin['@_ang'] || '0'), 10) || 0;
		const angle = (((angRaw / 60000) % 360) + 360) % 360;
		return { stops, angle, type: 'linear' };
	}
	if (gradNode['a:path'] !== undefined) {
		return { stops, type: 'radial' };
	}
	return { stops, type: 'linear' };
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

/**
 * Theme context needed to resolve a `a:tblBg/a:fillRef` style-matrix
 * reference into a concrete fill. Optional everywhere it's threaded through:
 * callers with no theme in scope (tests, the built-in-style-catalogue
 * generator) simply leave an unresolved `tblBg` fillRef as a reference only.
 */
export interface TableStyleThemeContext {
	formatScheme?: PptxThemeFormatScheme;
	colorMap?: Record<string, string>;
}

/** Parse a single `<a:tblStyle>` node. Returns `undefined` without a styleId. */
export function parseTableStyleEntry(
	style: XmlObject,
	resolveImagePath?: ResolveTableStyleImagePath,
	themeContext?: TableStyleThemeContext,
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

	const tableBackground = parseTableBackground(
		style['a:tblBg'] as XmlObject | undefined,
		themeContext?.formatScheme,
		themeContext?.colorMap,
	);
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
	themeContext?: TableStyleThemeContext,
): { map: ParsedTableStyleMap; defaultStyleId?: string } | undefined {
	const styleLst = parsed['a:tblStyleLst'] as XmlObject | undefined;
	if (!styleLst) {
		return undefined;
	}
	const rawDef = String(styleLst['@_def'] || '').trim();
	const defaultStyleId = rawDef ? normalizeTableStyleGuid(rawDef) : undefined;

	const map: ParsedTableStyleMap = {};
	for (const style of ensureArray(styleLst['a:tblStyle'])) {
		const entry = parseTableStyleEntry(style, resolveImagePath, themeContext);
		if (entry) {
			map[entry.styleId] = entry;
		}
	}
	if (Object.keys(map).length === 0 && !defaultStyleId) {
		return undefined;
	}
	return { map, ...(defaultStyleId ? { defaultStyleId } : {}) };
}
