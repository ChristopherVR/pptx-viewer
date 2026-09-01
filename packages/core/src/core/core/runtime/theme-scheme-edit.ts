/**
 * @fileoverview Pure edits applied by the theme-editing API to ONE parsed
 * `theme*.xml` document and to ONE in-memory colour/font map.
 *
 * `updateThemeColorScheme` / `updateThemeFontScheme` used to rewrite only the
 * primary theme part and only the global maps, so every other master of a
 * multi-master deck kept its old scheme, and the alias slots were baked as
 * `tx1 = dk1` / `bg1 = lt1` regardless of the master's `p:clrMap`. These
 * helpers take the target explicitly so the runtime can apply the same edit
 * to every theme part and every per-master map.
 */
import type { PptxThemeColorScheme, PptxThemeFontScheme, XmlObject } from '../../types';

/** The twelve `a:clrScheme` slots, in schema order. */
export const THEME_COLOR_SCHEME_KEYS: ReadonlyArray<keyof PptxThemeColorScheme> = [
	'dk1',
	'lt1',
	'dk2',
	'lt2',
	'accent1',
	'accent2',
	'accent3',
	'accent4',
	'accent5',
	'accent6',
	'hlink',
	'folHlink',
];

/**
 * The `p:clrMap` alias slots and where they route when a master declares no
 * clrMap (ECMA-376 S19.3.1.7 defaults).
 */
const DEFAULT_CLR_MAP_ALIASES: Readonly<Record<string, string>> = {
	tx1: 'dk1',
	bg1: 'lt1',
	tx2: 'dk2',
	bg2: 'lt2',
};

function normalizeHex(hex: string): string {
	return hex.replace(/^#/, '').toUpperCase();
}

/** Build an OOXML colour node (`a:srgbClr`) from a hex string. */
export function buildSrgbClrNode(hex: string): XmlObject {
	return { 'a:srgbClr': { '@_val': normalizeHex(hex) } };
}

function themeElementsOf(data: XmlObject): XmlObject | undefined {
	const root = data['a:theme'] as XmlObject | undefined;
	return root?.['a:themeElements'] as XmlObject | undefined;
}

/**
 * Rewrite the twelve `a:clrScheme` slots of a parsed theme document.
 *
 * @returns `false` when the document has no `a:themeElements` to edit
 */
export function applyColorSchemeToThemeXml(
	data: XmlObject,
	colorScheme: PptxThemeColorScheme,
): boolean {
	const themeElements = themeElementsOf(data);
	if (!themeElements) {
		return false;
	}
	const clrScheme = (themeElements['a:clrScheme'] ?? {}) as XmlObject;
	for (const key of THEME_COLOR_SCHEME_KEYS) {
		clrScheme[`a:${key}`] = buildSrgbClrNode(colorScheme[key]);
	}
	themeElements['a:clrScheme'] = clrScheme;
	return true;
}

function applyLatinTypeface(group: XmlObject | undefined, latin: string): XmlObject {
	const font = (group ?? {}) as XmlObject;
	font['a:latin'] = { '@_typeface': latin };
	if (!font['a:ea']) {
		font['a:ea'] = { '@_typeface': '' };
	}
	if (!font['a:cs']) {
		font['a:cs'] = { '@_typeface': '' };
	}
	return font;
}

/**
 * Rewrite the `a:majorFont` / `a:minorFont` latin typefaces of a parsed theme
 * document. Only the groups the scheme names are touched.
 *
 * @returns `false` when the document has no `a:themeElements` to edit
 */
export function applyFontSchemeToThemeXml(
	data: XmlObject,
	fontScheme: PptxThemeFontScheme,
): boolean {
	const themeElements = themeElementsOf(data);
	if (!themeElements) {
		return false;
	}
	const fntScheme = (themeElements['a:fontScheme'] ?? {}) as XmlObject;
	if (fontScheme.majorFont?.latin) {
		fntScheme['a:majorFont'] = applyLatinTypeface(
			fntScheme['a:majorFont'] as XmlObject | undefined,
			fontScheme.majorFont.latin,
		);
	}
	if (fontScheme.minorFont?.latin) {
		fntScheme['a:minorFont'] = applyLatinTypeface(
			fntScheme['a:minorFont'] as XmlObject | undefined,
			fontScheme.minorFont.latin,
		);
	}
	themeElements['a:fontScheme'] = fntScheme;
	return true;
}

/**
 * Write the twelve scheme slots into an in-memory colour map, then refresh
 * the alias slots (`tx1` / `bg1` / `tx2` / `bg2`) THROUGH the master's
 * `p:clrMap`, so a dark master that routes `bg1 -> dk1` keeps its swap.
 *
 * Alias slots are resolved lazily at lookup time by `resolveThemeColor`, but
 * chart and SmartArt colour readers index the map directly, so the cached
 * values must agree with the routing rather than assume the default one.
 *
 * @param clrMap the owning master's parsed clrMap, or `null` when it has none
 */
export function applyColorSchemeToMap(
	map: Record<string, string>,
	colorScheme: PptxThemeColorScheme,
	clrMap: Record<string, string> | null | undefined,
): void {
	for (const key of THEME_COLOR_SCHEME_KEYS) {
		map[key] = normalizeHex(colorScheme[key]);
	}
	for (const [alias, defaultTarget] of Object.entries(DEFAULT_CLR_MAP_ALIASES)) {
		const target = clrMap?.[alias] ?? defaultTarget;
		const resolved = map[target];
		if (resolved !== undefined) {
			map[alias] = resolved;
		}
	}
}

/** Write the latin typefaces of a font scheme into an in-memory font map. */
export function applyFontSchemeToMap(
	map: Record<string, string>,
	fontScheme: PptxThemeFontScheme,
): void {
	if (fontScheme.majorFont?.latin) {
		map['mj-lt'] = fontScheme.majorFont.latin;
		map['mj-ea'] = fontScheme.majorFont.latin;
		map['mj-cs'] = fontScheme.majorFont.latin;
	}
	if (fontScheme.minorFont?.latin) {
		map['mn-lt'] = fontScheme.minorFont.latin;
		map['mn-ea'] = fontScheme.minorFont.latin;
		map['mn-cs'] = fontScheme.minorFont.latin;
	}
}
