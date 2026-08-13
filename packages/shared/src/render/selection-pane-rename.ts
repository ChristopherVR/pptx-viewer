/**
 * What a Selection Pane rename commit means.
 *
 * All five bindings run the same little decision when a rename input is
 * committed (Enter, or blur), and all five had drifted into the same wrong
 * answer for one of its three cases. It lives here as a pure decision function
 * so the next correction lands once.
 */

/** The patch to merge onto the element, or `null` for "commit nothing". */
export interface SelectionPaneRenameCommit {
	/**
	 * The new `element.name`. Never `undefined`: the save writer
	 * (`applyNameToCnvPr`) reads `undefined` as "the model has no opinion, leave
	 * the markup alone", so committing it cannot express a clear.
	 */
	name: string;
}

/**
 * Decide what to commit for a Selection Pane rename.
 *
 * Three cases, and the middle one is the fix:
 *
 * 1. **Unedited** (the trimmed value equals the trimmed seed the input was
 *    opened with): `null`. Nothing is written, so a fallback display label
 *    ("Shape 3", or the element id) is never persisted as a real name just
 *    because the user double-clicked a row and clicked away.
 * 2. **Emptied**: `{ name: '' }`. Clearing the box has to mean something, and
 *    an explicit empty string is the ONLY value that means it. `@name` is
 *    REQUIRED on `CT_NonVisualDrawingProps` (ECMA-376 S20.1.2.2.8), so the
 *    attribute can never be deleted; the writer emits `name=""`. All five
 *    bindings used to commit `undefined` here, which the writer reads as "no
 *    opinion" (charts, SmartArt and other graphic frames parse without a
 *    `name` while their markup carries a real one, so blanking on `undefined`
 *    would wipe those on a plain round-trip). The result was that clearing a
 *    name in the pane did nothing at all: it did not reach the file, and on
 *    reload the old name came straight back.
 * 3. **Renamed**: `{ name: trimmed }`.
 *
 * @param seed  - The value the input was seeded with when editing began.
 * @param value - The current input value.
 * @returns The patch to apply, or `null` when the commit is a no-op.
 */
export function resolveSelectionPaneRename(
	seed: string,
	value: string,
): SelectionPaneRenameCommit | null {
	const trimmed = value.trim();
	if (trimmed === seed.trim()) {
		return null;
	}
	return { name: trimmed };
}
