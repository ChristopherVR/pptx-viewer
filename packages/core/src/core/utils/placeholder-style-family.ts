/**
 * Normalisation of `p:ph/@type` onto the family a placeholder inherits from.
 *
 * Two things make the raw attribute a poor identity. It is optional and
 * defaults to `body`, and slides routinely omit it while the layout entry for
 * the same placeholder spells a type out. And several types name the same
 * inheritance target: `ctrTitle` draws on the master's title styles, while
 * `obj` and `subtitle` draw on its body styles. Comparing raw attributes
 * therefore reports two descriptions of one placeholder as different
 * placeholders, which loses the layout-level values that description carried.
 *
 * @module placeholder-style-family
 */

/** Types that resolve against the master's `p:titleStyle`. */
const TITLE_FAMILY: ReadonlySet<string> = new Set(['title', 'ctrtitle']);

/** Types that resolve against the master's `p:bodyStyle`. */
const BODY_FAMILY: ReadonlySet<string> = new Set(['body', 'obj', 'subtitle']);

/**
 * Resolve a placeholder type to its style family.
 *
 * @param type - Lower-cased `p:ph/@type`, or `undefined` when omitted.
 * @returns `'title'`, `'body'`, or the type itself for the remaining
 *   placeholder kinds (`dt`, `ftr`, `sldNum`, `pic`, `chart`, and so on), which
 *   resolve against `p:otherStyle` and have no aliases.
 */
export function placeholderStyleFamily(type: string | undefined): string {
	const declared = (type ?? '').trim().toLowerCase() || 'body';
	if (TITLE_FAMILY.has(declared)) {
		return 'title';
	}
	if (BODY_FAMILY.has(declared)) {
		return 'body';
	}
	return declared;
}
