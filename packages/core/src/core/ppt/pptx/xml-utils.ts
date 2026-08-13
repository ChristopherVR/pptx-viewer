/**
 * Small XML helpers for the generated PPTX parts.
 *
 * @module ppt/pptx/xml-utils
 */

import { encodeXmlAttributeValue, encodeXmlTextValue } from '../../utils/xml-entities';

/**
 * True for control characters that are invalid in XML 1.0 text.
 *
 * XML 1.0 §2.2 admits only tab, line feed and carriage return below U+0020, so
 * `\v` (0x0B) and `\f` (0x0C) are illegal too: a package containing one is
 * rejected outright rather than merely rendering oddly.
 */
function isInvalidXmlChar(code: number): boolean {
	return (
		(code >= 0x00 && code <= 0x08) ||
		code === 0x0b ||
		code === 0x0c ||
		(code >= 0x0e && code <= 0x1f)
	);
}

/** Drop every character XML 1.0 forbids outright. */
function stripInvalidXmlChars(value: string): string {
	let cleaned = '';
	for (const ch of value) {
		if (!isInvalidXmlChar(ch.charCodeAt(0))) {
			cleaned += ch;
		}
	}
	return cleaned;
}

/** Escape text content for XML. */
export function esc(value: string): string {
	return stripInvalidXmlChars(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Escape a value for an ATTRIBUTE inside a hand-written XML template such as
 * `` `<p:cSld name="${escAttr(name)}">` ``.
 *
 * This is `encodeXmlAttributeValue` (which carries the XML 1.0 §3.3.3 rule that
 * a literal newline or tab inside an attribute is normalised to a space on
 * read-back, so both must become numeric references) PLUS the quote delimiters.
 * The raw `encodeXmlAttributeValue` deliberately leaves `"` and `'` alone
 * because its own caller, fast-xml-parser, escapes the delimiter itself
 * immediately afterwards; a template literal has no such second pass, so an
 * unescaped `"` in a name would terminate the attribute and produce a package
 * PowerPoint refuses to open.
 */
export function escAttr(value: string): string {
	return encodeXmlAttributeValue(stripInvalidXmlChars(value))
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Escape a value for ELEMENT TEXT inside a hand-written XML template such as
 * `` `<dc:title>${escText(title)}</dc:title>` ``.
 *
 * Prefer this over {@link esc} for text nodes: it additionally writes `\r` as
 * `&#xD;`, the one character that XML line-ending normalisation would otherwise
 * destroy on the way back in.
 */
export function escText(value: string): string {
	return encodeXmlTextValue(stripInvalidXmlChars(value));
}

/** Uppercase hex color without '#'. */
export function hexColor(rgb: string): string {
	return rgb.replace(/^#/, '').toUpperCase();
}

/** A solid fill element. */
export function solidFill(rgb: string): string {
	return `<a:solidFill><a:srgbClr val="${hexColor(rgb)}"/></a:solidFill>`;
}

/** Clamp and round an EMU value to a safe integer. */
export function emu(value: number): number {
	return Math.round(value);
}
