/**
 * picture-non-visual-parse.ts - pure parse of `a:cNvPicPr`'s non-lock
 * non-visual attributes.
 *
 * Extracted from {@link PptxHandlerRuntimePictureParsing} (already large) so
 * this addition doesn't grow that file further, and so it is directly
 * unit-testable without instantiating the runtime.
 */

/**
 * Parse `a:cNvPicPr/@preferRelativeResize` (ST_Boolean, issue G13).
 *
 * The spec default is `true` when the attribute is absent, so an absent
 * attribute surfaces as `undefined` (not `true`) to distinguish "not
 * authored" from "explicitly authored true" for a lossless round-trip; only
 * an explicit `0`/`false` becomes `false`.
 */
export function parsePreferRelativeResize(raw: unknown): boolean | undefined {
	if (raw === undefined) {
		return undefined;
	}
	const value = String(raw).trim().toLowerCase();
	return !(value === '0' || value === 'false');
}
