/**
 * Decimal tab (`a:tab algn="dec"`) anchoring, COM-verified against a
 * PowerPoint export of a 300pt decimal stop (2026-09 limitations wave):
 *
 * - the anchor is the decimal separator of the RUN's language, not always
 *   `.`: a `de-DE` or `fr-FR` run aligns on `,` (`1.234,56`), an `en-US`
 *   or `ja-JP` run on `.` (`1,234.56`);
 * - only the FIRST number in the piece counts: starting at its first digit
 *   it runs over digits, `.` and `,` (a space ends it, so `fr-FR`
 *   `1 234,56` anchors after the `1`);
 * - a number without the separator aligns its END on the stop (`123 units`,
 *   `en-US 1234,56`, `de-DE 7.5`, `12abc.5` after the `12`);
 * - a piece with no digit at all behaves like a right tab.
 *
 * @module text-tab-decimal
 */

/** The decimal separator `Intl` reports for a BCP-47 tag, or `.` when unknown. */
export function decimalSeparatorForLanguage(language: string | undefined): string {
	if (!language) {
		return '.';
	}
	try {
		const part = new Intl.NumberFormat(language)
			.formatToParts(1.5)
			.find((p) => p.type === 'decimal');
		return part?.value ?? '.';
	} catch {
		return '.';
	}
}

/**
 * The length (in characters) of `text`'s prefix that sits LEFT of the
 * decimal-tab anchor, or `text.length` when the whole piece right-aligns.
 */
export function decimalAnchorIndex(text: string, separator: string): number {
	const first = text.search(/[0-9]/u);
	if (first < 0) {
		return text.length;
	}
	let end = first;
	while (end < text.length && /[0-9.,]/u.test(text[end])) {
		end++;
	}
	const sep = text.slice(first, end).indexOf(separator);
	return sep >= 0 ? first + sep : end;
}
