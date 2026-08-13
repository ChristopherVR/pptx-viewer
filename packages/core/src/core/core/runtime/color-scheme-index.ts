/**
 * @fileoverview `ST_ColorSchemeIndex` normalisation (ECMA-376 §20.1.10.14).
 *
 * Every attribute of `p:clrMap` (§19.3.1.6) and `a:overrideClrMapping`
 * (§20.1.6.13) is valued with an `ST_ColorSchemeIndex` token. The enumeration
 * is CASE SENSITIVE and eleven of its twelve members are already lower-case,
 * so a `.toLowerCase()` anywhere on the path is a silent no-op on all of them
 * and fatal on `folHlink`, the one camel-cased member. PowerPoint does not
 * degrade gracefully for a single bad token here: it refuses the WHOLE package
 * with `0x80070570` ("the file or directory is corrupted and unreadable").
 * That was a real shipped defect on `descender-clip.pptx` and
 * `shape-3d-compound.pptx`.
 *
 * The lesson is the repo-wide one: normalise TO the legal token set, never
 * lowercase-and-hope. {@link normalizeColorSchemeIndex} accepts any casing,
 * returns the spec spelling, and returns `undefined` for anything outside the
 * enumeration so the caller can drop it instead of writing it back out.
 */

import type { XmlObject } from '../../types';
import { COLOR_MAP_ALIAS_KEYS } from '../../utils/theme-override-utils';

/**
 * The twelve theme slots a colour-map alias may point at, in spec casing.
 *
 * Note these are the VALUES, not the attribute names: the attribute names are
 * the aliases (`bg1`, `tx1`, `bg2`, `tx2`, `accent1`..`accent6`, `hlink`,
 * `folHlink`) and only the last eight spellings are common to both sets.
 */
export const COLOR_SCHEME_INDEX_TOKENS = [
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
] as const;

export type ColorSchemeIndexToken = (typeof COLOR_SCHEME_INDEX_TOKENS)[number];

const CANONICAL_BY_LOWERCASE = new Map<string, ColorSchemeIndexToken>(
	COLOR_SCHEME_INDEX_TOKENS.map((token) => [token.toLowerCase(), token]),
);

/**
 * The four alias spellings that are NOT `ST_ColorSchemeIndex` members but that
 * some producers write in place of the slot they denote. Folding each to its
 * slot keeps the meaning the renderer already gives it (`mergeThemeColorOverride`
 * resolves `bg1` against `lt1`) while making the attribute legal on the way out.
 * Without the fold such a value would be written back verbatim and take the
 * package down exactly like `folhlink` did.
 */
const ALIAS_SPELLING_TO_SLOT: Record<string, ColorSchemeIndexToken> = {
	bg1: 'lt1',
	tx1: 'dk1',
	bg2: 'lt2',
	tx2: 'dk2',
};

/**
 * Normalise a raw colour-map attribute value to its `ST_ColorSchemeIndex`
 * token.
 *
 * @returns The spec-cased token, or `undefined` when the input is empty or is
 *          not a recognised slot. Callers must DROP an `undefined` rather than
 *          fall back to the raw text: a value outside the enumeration makes
 *          PowerPoint reject the entire package.
 */
export function normalizeColorSchemeIndex(raw: unknown): ColorSchemeIndexToken | undefined {
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const trimmed = String(raw).trim();
	if (!trimmed) {
		return undefined;
	}
	const lowered = trimmed.toLowerCase();
	return CANONICAL_BY_LOWERCASE.get(lowered) ?? ALIAS_SPELLING_TO_SLOT[lowered];
}

/**
 * Read an `a:overrideClrMapping` node into an `alias -> slot` record with every
 * value normalised to its `ST_ColorSchemeIndex` token.
 *
 * The record is written straight back out by `buildClrMapOverrideXml`, so a
 * value that is not in the enumeration is DROPPED and reported rather than
 * passed through: the writer then supplies the standard default for that alias,
 * which keeps the package openable. Passing it through does not.
 *
 * @returns `null` when the node yields no usable alias at all.
 */
export function parseOverrideClrMapping(
	overrideNode: XmlObject,
	onInvalid?: (alias: string, rawValue: string) => void,
): Record<string, string> | null {
	const overrideMap: Record<string, string> = {};
	for (const key of COLOR_MAP_ALIAS_KEYS) {
		const raw = overrideNode[`@_${key}`];
		const mapped = normalizeColorSchemeIndex(raw);
		if (mapped) {
			overrideMap[key] = mapped;
			continue;
		}
		const rawText = raw === undefined || raw === null ? '' : String(raw).trim();
		if (rawText) {
			onInvalid?.(key, rawText);
		}
	}
	return Object.keys(overrideMap).length > 0 ? overrideMap : null;
}
