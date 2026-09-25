/**
 * Small table-style resolution helpers kept out of the (already long)
 * `table-style-fill.ts` / `table-style.ts`.
 *
 * @module render/table-style-scheme
 */
import type { ParsedTableStyleEntry, PptxThemeColorScheme } from 'pptx-viewer-core';

/** Default `p:clrMap` aliases (ECMA-376 19.3.1.6) for scheme keys a clrScheme lacks. */
const SCHEME_ALIASES: Readonly<Record<string, string>> = {
	tx1: 'dk1',
	bg1: 'lt1',
	tx2: 'dk2',
	bg2: 'lt2',
};

/**
 * The hex a table style's scheme key resolves to. The neutral built-in styles
 * ("Light Style 1", "No Style, Table Grid", ...) reference `tx1` / `bg1`,
 * which a theme's clrScheme never carries, so those route through the
 * default clrMap (tx1 = dk1, bg1 = lt1).
 */
export function tableSchemeColor(
	colorScheme: PptxThemeColorScheme,
	key: string,
): string | undefined {
	const scheme = colorScheme as unknown as Record<string, string | undefined>;
	return scheme[key] ?? scheme[SCHEME_ALIASES[key] ?? ''];
}

const SECTION_FILL_KEYS = [
	'wholeTblFill',
	'band1HFill',
	'band2HFill',
	'band1VFill',
	'band2VFill',
	'firstRowFill',
	'lastRowFill',
	'firstColFill',
	'lastColFill',
] as const;

/**
 * True when a table style declares any section fill (or a `tblBg`), i.e. it
 * decides every section's paint itself. PowerPoint's built-ins all do, so a
 * missing section there means "no fill", not "use a generic default".
 */
export function styleDeclaresFills(entry: ParsedTableStyleEntry | undefined): boolean {
	if (!entry) {
		return false;
	}
	return (
		entry.tableBackground?.fill !== undefined ||
		SECTION_FILL_KEYS.some((key) => entry[key] !== undefined)
	);
}
