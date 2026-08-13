/**
 * Normalisation of `p:ph/@idx` onto a usable placeholder index.
 *
 * `CT_Placeholder/@idx` is an `ST_Index` (`xsd:unsignedInt`), so the attribute
 * cannot carry a negative number. PowerPoint nevertheless needs a way to say
 * "this placeholder no longer has a counterpart on the layout", and it does so
 * by writing the two's-complement of -1 into that unsigned field:
 * `idx="4294967295"` (`0xFFFFFFFF`). It is a sentinel, not an index, and no
 * layout or master will ever declare a placeholder that matches it.
 *
 * Treating the sentinel as a real index makes every lookup for such a shape
 * miss, which is how a `p:sp` with a perfectly ordinary `p:txBody` ended up
 * resolving no geometry and being discarded before it reached the model. The
 * fix is to erase the sentinel at the parse boundary so the placeholder falls
 * back to matching on its `type`, which is exactly what PowerPoint renders.
 *
 * @module placeholder-index
 */

/**
 * The unsigned encoding of -1 that PowerPoint writes for an orphaned
 * placeholder reference.
 */
export const ORPHANED_PLACEHOLDER_INDEX = 4294967295;

/**
 * Normalise a raw `p:ph/@idx` attribute value.
 *
 * @param raw - The attribute exactly as parsed, or `undefined` when omitted.
 * @returns The index as a canonical decimal string, or `undefined` when the
 *   attribute was absent, was the orphaned-placeholder sentinel, or did not
 *   parse as a non-negative integer. `undefined` means "match on type alone",
 *   which callers already handle as the default-index case.
 */
export function normalizePlaceholderIndex(raw: unknown): string | undefined {
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const text = String(raw).trim();
	if (text.length === 0) {
		return undefined;
	}
	// `parseTagValue` is pinned off for the whole package, so the attribute
	// always arrives as text and a non-numeric value is a real possibility.
	if (!/^\d+$/.test(text)) {
		return undefined;
	}
	const value = Number.parseInt(text, 10);
	if (!Number.isSafeInteger(value) || value === ORPHANED_PLACEHOLDER_INDEX) {
		return undefined;
	}
	return String(value);
}
