/**
 * Pure regex-based XML extraction utilities for digital signature processing.
 *
 * These functions operate on raw XML strings without requiring a DOM parser,
 * making them platform-agnostic (browser + Node).
 */

/**
 * Escape special characters in an XML attribute value.
 * Handles `&`, `<`, `>`, `"`, and `'` so the result is safe inside both
 * double- and single-quoted attributes.
 */
export function escapeXmlAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Escape special characters in XML text content.
 * Only `&`, `<`, and `>` need escaping outside of attribute values.
 */
export function escapeXmlText(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Validate that `value` only contains characters from the standard base64 alphabet. */
export function isValidBase64(value: string): boolean {
	return typeof value === 'string' && value.length > 0 && /^[A-Za-z0-9+/=\s]+$/.test(value);
}

/**
 * Extract an attribute value from the first matching XML tag via regex.
 * Namespace prefixes on the tag name are supported via the pattern.
 */
export function extractTagAttribute(
	xml: string,
	tagName: string,
	attributeName: string,
): string | undefined {
	const pattern = new RegExp(
		`<${tagName}\\b[^>]*\\b${attributeName}="(?<attributeValue>[^"]+)"`,
		'i',
	);
	const match = xml.match(pattern);
	return match?.groups?.['attributeValue']?.trim();
}

/**
 * Extract the text content of the first matching tag, ignoring namespace prefixes.
 * Whitespace within the content is collapsed.
 */
export function extractFirstTagText(xml: string, localName: string): string | undefined {
	const pattern = new RegExp(
		`<([\\w.-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/([\\w.-]+:)?${localName}>`,
		'i',
	);
	const match = xml.match(pattern);
	return match?.[2]?.replace(/\s+/g, '').trim() || undefined;
}

/**
 * Extract the text content of all matching tags, ignoring namespace prefixes.
 * Whitespace within each match is collapsed.
 */
export function extractAllTagText(xml: string, localName: string): string[] {
	const result: string[] = [];
	const regex = new RegExp(
		`<([\\w.-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/([\\w.-]+:)?${localName}>`,
		'gi',
	);
	let match: RegExpExecArray | null = regex.exec(xml);
	while (match) {
		const value = match[2]?.replace(/\s+/g, '').trim();
		if (value) {
			result.push(value);
		}
		match = regex.exec(xml);
	}
	return result;
}
