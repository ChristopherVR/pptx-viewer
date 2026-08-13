/**
 * table-style-builtins.ts - lookup for PowerPoint's 74 built-in table styles.
 *
 * `ppt/tableStyles.xml` only contains the styles a deck customised, so a table
 * referencing a built-in gallery style (the overwhelmingly common case) has no
 * entry to resolve and used to fall through to a hardcoded blue. This module
 * expands the generated catalogue in `table-style-builtins-data.ts` into
 * {@link ParsedTableStyleEntry} objects - the exact same shape the loader
 * produces for a deck-authored style - so the renderer cannot tell the
 * difference and the theme's own accent colours resolve normally.
 *
 * A deck's own `tableStyles.xml` entry always wins: callers look there first
 * and only consult {@link getBuiltinTableStyle} on a miss.
 *
 * @module table-style-builtins
 */
import type { ParsedTableStyleEntry, ParsedTableStyleMap } from 'pptx-viewer-core';

import { BUILTIN_TABLE_STYLE_JSON } from './table-style-builtins-data';

/** One accent variant of a family: its GUID, name, and accent number(s). */
interface BuiltinVariant {
	id: string;
	name: string;
	/** Primary accent number (1-6) this variant uses. */
	a: number;
	/** Secondary accent number, for the "Dark Style 2 - Accent 1/Accent 2" family. */
	b?: number;
}

/** An accent family: one template entry plus the variants derived from it. */
interface BuiltinFamily {
	baseAccent: number;
	baseAccent2?: number;
	template: ParsedTableStyleEntry;
	variants: BuiltinVariant[];
}

interface BuiltinCatalogue {
	families: BuiltinFamily[];
	standalone: ParsedTableStyleEntry[];
}

/**
 * Rewrite every `accentN` reference in an entry. Scheme colours appear in a
 * dozen nested places (section fills, gradient stops, pattern fg/bg, border
 * fills, text colours, `accentKey`), so the substitution is done over the
 * serialised form rather than by walking a field list that would drift the
 * moment a new field is parsed.
 */
function substituteAccent(
	template: ParsedTableStyleEntry,
	from: number,
	to: number,
	from2: number | undefined,
	to2: number | undefined,
): ParsedTableStyleEntry {
	// `split`/`join` rather than `String.replaceAll`: Angular's ng-packagr build
	// compiles this vendored source against an older `lib` where `replaceAll`
	// does not exist, and the failure is a build error in ONE binding only.
	const swap = (input: string, needle: string, value: string): string =>
		input.split(needle).join(value);
	let json = JSON.stringify(template);
	if (from2 !== undefined && to2 !== undefined) {
		// Two-accent family: park the second key under a token first so a
		// 1 -> 2 rename cannot then be caught by the 2 -> N rename.
		json = swap(json, `accent${from2}`, '@@ACC2@@');
		json = swap(json, `accent${from}`, `accent${to}`);
		json = swap(json, '@@ACC2@@', `accent${to2}`);
	} else {
		json = swap(json, `accent${from}`, `accent${to}`);
	}
	return JSON.parse(json) as ParsedTableStyleEntry;
}

let catalogue: ParsedTableStyleMap | undefined;

/**
 * The full built-in catalogue as a GUID -> entry map. Built once on first use
 * (the payload is a ~25 KB JSON string) and cached for the process lifetime.
 */
export function builtinTableStyleMap(): ParsedTableStyleMap {
	if (catalogue) {
		return catalogue;
	}
	const map: ParsedTableStyleMap = {};
	const data = JSON.parse(BUILTIN_TABLE_STYLE_JSON) as BuiltinCatalogue;
	for (const family of data.families) {
		for (const variant of family.variants) {
			const entry = substituteAccent(
				family.template,
				family.baseAccent,
				variant.a,
				family.baseAccent2,
				variant.b,
			);
			entry.styleId = variant.id;
			entry.styleName = variant.name;
			map[variant.id] = entry;
		}
	}
	for (const entry of data.standalone) {
		map[entry.styleId] = entry;
	}
	catalogue = map;
	return map;
}

/**
 * Look up one of PowerPoint's built-in table styles by GUID.
 *
 * @param styleId - The `a:tblPr/a:tableStyleId` GUID, with or without braces
 *   and in any case.
 * @returns The style entry, or `undefined` when the GUID is not a built-in.
 */
export function getBuiltinTableStyle(
	styleId: string | undefined,
): ParsedTableStyleEntry | undefined {
	if (!styleId) {
		return undefined;
	}
	const normalised = styleId.trim().toUpperCase();
	const withBraces = normalised.startsWith('{') ? normalised : `{${normalised}}`;
	return builtinTableStyleMap()[withBraces];
}

/**
 * The display name PowerPoint gives a built-in style GUID (e.g.
 * `"Medium Style 2 - Accent 1"`), for style pickers and inspectors.
 */
export function getBuiltinTableStyleName(styleId: string | undefined): string | undefined {
	return getBuiltinTableStyle(styleId)?.styleName;
}
