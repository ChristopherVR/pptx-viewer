/**
 * OOXML placeholder type enum validation.
 *
 * Validates placeholder type strings against the full set of
 * ST_PlaceholderType values defined in ECMA-376.
 *
 * @module pptx-utils/placeholder-validation
 */

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
 * Normalize a placeholder type string. Returns the type if valid,
 * or 'body' as the OOXML default when the type is empty or undefined.
 *
 * @param type - Raw placeholder type string from XML.
 * @returns Normalized placeholder type string.
 */
export function normalizePlaceholderType(
	type: string | undefined,
): string {
	if (!type) return 'body';
	const trimmed = type.trim().toLowerCase();
	// OOXML types are case-sensitive in the spec, but we normalize for robustness
	if (trimmed.length === 0) return 'body';
	return trimmed;
}

/**
 * Get the complete set of valid placeholder type strings.
 */
export function getValidPlaceholderTypes(): ReadonlySet<string> {
	return VALID_PLACEHOLDER_TYPES;
}
