/**
 * css-escape.ts: escape a value for use inside an attribute selector.
 *
 * Every binding locates a rendered element by id with
 * `querySelector('[data-element-id="<id>"]')`. Browsers provide `CSS.escape`
 * for that, but the bindings also run under test DOMs (happy-dom / jsdom)
 * where it can be missing, and several copies of a hand-rolled fallback had
 * drifted: one escaped only the quote and left a backslash able to eat the
 * closing quote, another escaped nothing at all.
 *
 * @module render/css-escape
 */

/**
 * Escape `value` so it can be spliced into a double-quoted CSS attribute
 * selector. Uses `CSS.escape` when available; otherwise escapes the quote
 * and the backslash in ONE pass, so an escape sequence produced for the
 * quote cannot itself be re-escaped or a backslash in the input cannot
 * neutralise the closing quote.
 */
export function escapeCssAttributeValue(value: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		return CSS.escape(value);
	}
	return value.replace(/["\\]/gu, '\\$&');
}

/** `[data-element-id="<id>"]`, with the id escaped for the selector. */
export function elementIdSelector(id: string): string {
	return `[data-element-id="${escapeCssAttributeValue(id)}"]`;
}
