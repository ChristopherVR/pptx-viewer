/**
 * Linear-time scanner for the XAdES `<EncapsulatedTimeStamp>` /
 * `<SignatureTimeStamp>` elements inside an XML signature.
 *
 * A single regex like
 * `<(?:prefix:)?(?:EncapsulatedTimeStamp|SignatureTimeStamp)[^>]*>([\s\S]*?)<\/...>`
 * applied unanchored to the whole document is applied by the engine at
 * every possible start position. Input with many repetitions of the tag
 * name and no closing `>` (e.g. `<-:encapsulatedtimestamp` repeated) makes
 * each attempt rescan the remaining text, a quadratic-time blowup on
 * adversarial input.
 *
 * This scanner instead walks the document via `indexOf('<', ...)` (linear,
 * no backtracking) and only tests a small bounded window around each `<`
 * against the tag patterns, so the worst-case cost stays proportional to
 * the document length regardless of how the input is crafted.
 */

const MAX_TAG_WINDOW = 256;

const OPEN_TAG_PATTERN = /^<(?:[\w.-]+:)?(?:EncapsulatedTimeStamp|SignatureTimeStamp)\b[^>]*>/i;
const CLOSE_TAG_PATTERN = /^<\/(?:[\w.-]+:)?(?:EncapsulatedTimeStamp|SignatureTimeStamp)>/i;

function findCloseTagIndex(xml: string, fromIndex: number): number | undefined {
	let searchFrom = fromIndex;
	for (;;) {
		const ltIndex = xml.indexOf('<', searchFrom);
		if (ltIndex === -1) {
			return undefined;
		}
		const window = xml.slice(ltIndex, ltIndex + MAX_TAG_WINDOW);
		if (CLOSE_TAG_PATTERN.test(window)) {
			return ltIndex;
		}
		searchFrom = ltIndex + 1;
	}
}

/**
 * Find the inner text content of the first `EncapsulatedTimeStamp` or
 * `SignatureTimeStamp` element in `xml` (namespace prefix ignored),
 * scanning in linear time. Returns `undefined` if no such element exists.
 */
export function findTimestampTagContent(xml: string): string | undefined {
	let searchFrom = 0;
	for (;;) {
		const ltIndex = xml.indexOf('<', searchFrom);
		if (ltIndex === -1) {
			return undefined;
		}
		const window = xml.slice(ltIndex, ltIndex + MAX_TAG_WINDOW);
		const openMatch = OPEN_TAG_PATTERN.exec(window);
		if (openMatch) {
			const contentStart = ltIndex + openMatch[0].length;
			const closeIndex = findCloseTagIndex(xml, contentStart);
			return closeIndex === undefined ? undefined : xml.slice(contentStart, closeIndex);
		}
		searchFrom = ltIndex + 1;
	}
}
