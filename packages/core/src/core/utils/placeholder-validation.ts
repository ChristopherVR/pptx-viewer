/**
 * OOXML placeholder type enum validation.
 *
 * Validates placeholder type strings against the full set of
 * ST_PlaceholderType values defined in ECMA-376.
 *
 * @module pptx-utils/placeholder-validation
 */
import type { XmlObject } from '../types';

/**
 * All valid OOXML placeholder types from `ST_PlaceholderType`.
 * @see ECMA-376 Part 1, 19.7.10
 */
const VALID_PLACEHOLDER_TYPES = new Set([
	'body',
	'chart',
	'clipArt',
	'ctrTitle',
	'dgm',
	'dt',
	'ftr',
	'hdr',
	'media',
	'obj',
	'pic',
	'sldImg',
	'sldNum',
	'subTitle',
	'tbl',
	'title',
	// Additional types from extended specs
	'half',
	'qtr',
	'txAndClipArt',
	'txAndChart',
	'txAndMedia',
	'txAndObj',
	'txAndTwoObj',
	'txOverObj',
	'objAndTx',
	'twoObj',
	'twoObjAndObj',
	'twoObjAndTx',
	'twoObjOverTx',
	'objOverTx',
	'twoColTx',
	'fourObj',
]);

/** Lower-cased spelling -> canonical (schema) spelling. */
const CANONICAL_BY_LOWER = new Map<string, string>(
	Array.from(VALID_PLACEHOLDER_TYPES, (type) => [type.toLowerCase(), type]),
);

/**
 * Check whether a placeholder type string is a valid OOXML placeholder type.
 *
 * @param type - The placeholder type string to validate.
 * @returns `true` if the type is a recognised OOXML placeholder type.
 */
export function isValidPlaceholderType(type: string): boolean {
	return VALID_PLACEHOLDER_TYPES.has(type);
}

/**
 * The canonical `ST_PlaceholderType` spelling of a value, matched
 * case-insensitively (`ctrtitle` -> `ctrTitle`, `SLDNUM` -> `sldNum`), or
 * `undefined` when the value is not a placeholder type at all.
 *
 * The enum is case-sensitive, so a deck authored by a tool that lower-cases
 * the value is schema-invalid even though every reader knows what it meant.
 */
export function canonicalPlaceholderType(value: unknown): string | undefined {
	const text = String(value ?? '').trim();
	if (text.length === 0) {
		return undefined;
	}
	return CANONICAL_BY_LOWER.get(text.toLowerCase());
}

/**
 * Normalize a placeholder type string to its canonical schema spelling.
 * Returns `'body'` (the OOXML default) when the value is empty, and the
 * trimmed input unchanged when it is not a known placeholder type.
 *
 * @param type - Raw placeholder type string from XML.
 * @returns Normalized placeholder type string.
 */
export function normalizePlaceholderType(type: string | undefined): string {
	const trimmed = type?.trim() ?? '';
	if (trimmed.length === 0) {
		return 'body';
	}
	return canonicalPlaceholderType(trimmed) ?? trimmed;
}

/**
 * Rewrite every `p:ph/@type` under `root` to its canonical spelling.
 *
 * Values that are already canonical, or that are not placeholder types, are
 * left untouched, so a part with nothing to fix is not modified at all.
 *
 * @returns The number of attributes changed.
 */
export function canonicalizePlaceholderTypes(root: unknown): number {
	let changed = 0;
	const visit = (value: unknown, tag: string): void => {
		if (Array.isArray(value)) {
			for (const item of value) {
				visit(item, tag);
			}
			return;
		}
		if (!value || typeof value !== 'object') {
			return;
		}
		const node = value as XmlObject;
		if (tag === 'p:ph' && node['@_type'] !== undefined) {
			const canonical = canonicalPlaceholderType(node['@_type']);
			if (canonical !== undefined && canonical !== String(node['@_type'])) {
				node['@_type'] = canonical;
				changed += 1;
			}
		}
		for (const [key, child] of Object.entries(node)) {
			if (!key.startsWith('@_')) {
				visit(child, key);
			}
		}
	};
	visit(root, '');
	return changed;
}

/**
 * Get the complete set of valid placeholder type strings.
 */
export function getValidPlaceholderTypes(): ReadonlySet<string> {
	return VALID_PLACEHOLDER_TYPES;
}
