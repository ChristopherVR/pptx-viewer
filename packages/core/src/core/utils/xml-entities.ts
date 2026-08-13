/**
 * XML predefined-entity + numeric-character-reference decoding for parsed text.
 *
 * The OOXML parser runs with fast-xml-parser `processEntities: false` as a
 * security hardening (PPTX never uses DOCTYPE / DTD entity definitions, so
 * disabling entity processing removes the billion-laughs / external-entity
 * attack surface). The side effect is that the five predefined XML entities and
 * numeric character references in element text are left ENCODED in the parsed
 * model, e.g. `<a:t>Tom &amp; Jerry</a:t>` parses to the literal string
 * `"Tom &amp; Jerry"`, which then renders as `Tom &amp; Jerry` instead of
 * `Tom & Jerry`, and double-encodes to `&amp;amp;` on save.
 *
 * This helper decodes only the five predefined entities and numeric references
 * (which cannot trigger entity expansion, so the security guarantee is kept). It
 * is wired into the parser's `tagValueProcessor` so text nodes hold their real
 * characters; the builder then re-encodes them symmetrically on save, fixing
 * both the display and the round-trip.
 *
 * @module utils/xml-entities
 */

const NUMERIC_HEX = /&#x(?<hex>[0-9a-fA-F]+);/gu;
const NUMERIC_DEC = /&#(?<dec>\d+);/gu;

/**
 * Decode the five predefined XML entities (`&lt; &gt; &quot; &apos; &amp;`) and
 * decimal / hexadecimal numeric character references in `value`. Non-string
 * input and strings without an `&` are returned unchanged (fast path).
 *
 * `&amp;` is decoded LAST so an already-escaped sequence such as `&amp;lt;`
 * decodes to the literal text `&lt;` rather than to `<`.
 */
export function decodeXmlEntities(value: string): string;
export function decodeXmlEntities(value: unknown): unknown;
export function decodeXmlEntities(value: unknown): unknown {
	if (typeof value !== 'string' || !value.includes('&')) {
		return value;
	}
	return value
		.replace(NUMERIC_HEX, (_match, hex: string) => codePointToString(parseInt(hex, 16)))
		.replace(NUMERIC_DEC, (_match, dec: string) => codePointToString(parseInt(dec, 10)))
		.replace(/&lt;/gu, '<')
		.replace(/&gt;/gu, '>')
		.replace(/&quot;/gu, '"')
		.replace(/&apos;/gu, "'")
		.replace(/&amp;/gu, '&');
}

/**
 * Encode `value` for use as ELEMENT TEXT.
 *
 * This reproduces fast-xml-parser's own default `entities` list (`&` first, then
 * `>`, `<`, `'`, `"`) so switching the builder to `processEntities: false` is
 * byte-for-byte neutral for text nodes, and adds `\r`. A literal carriage return
 * in content is destroyed by XML line-ending normalisation (the reader rewrites
 * `\r\n` and `\r` to `\n` before parsing), so it is the one character that has
 * to be written as a numeric reference to survive a round trip.
 */
export function encodeXmlTextValue(value: string): string {
	return value
		.replace(/&/gu, '&amp;')
		.replace(/>/gu, '&gt;')
		.replace(/</gu, '&lt;')
		.replace(/'/gu, '&apos;')
		.replace(/"/gu, '&quot;')
		.replace(/\r/gu, '&#xD;');
}

/**
 * Encode `value` for use as an ATTRIBUTE value.
 *
 * `"` and `'` are deliberately NOT handled here: fast-xml-parser escapes the
 * quote delimiters itself, unconditionally, immediately after this processor
 * runs, so doing it twice would emit `&amp;quot;`.
 *
 * Tab, line feed and carriage return MUST be numeric references. XML attribute
 * -value normalisation (spec 3.3.3) replaces every literal whitespace character
 * in an attribute with a space on read-back, so writing a raw `\n` inside
 * `descr="…"` silently turns the alt text's line breaks into spaces. Only the
 * `&#xA;` form survives.
 */
export function encodeXmlAttributeValue(value: string): string {
	return value
		.replace(/&/gu, '&amp;')
		.replace(/>/gu, '&gt;')
		.replace(/</gu, '&lt;')
		.replace(/\r/gu, '&#xD;')
		.replace(/\n/gu, '&#xA;')
		.replace(/\t/gu, '&#x9;');
}

/** Convert a code point to a string, leaving out-of-range values untouched. */
function codePointToString(codePoint: number): string {
	if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
		return '';
	}
	try {
		return String.fromCodePoint(codePoint);
	} catch {
		return '';
	}
}
