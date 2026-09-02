/**
 * HTML/text escaping shared by every print-document markup builder
 * (`print-document.ts`, `handout-chrome-html.ts`). Split out of
 * `print-document.ts` (which was already over this repo's 300-LOC-per-file
 * guideline) so it can be reused without a circular import between the two.
 *
 * ng-packagr constraint honoured here (the Angular binding inlines this
 * source and compiles it through ng-packagr): NO `String.prototype.replaceAll`
 * (`escapeHtml` uses `.split(x).join(y)` instead).
 */

/** Transparent 1x1 PNG used as a safe fallback for non-data image sources. */
const TRANSPARENT_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

/**
 * Escape text for safe interpolation into HTML element content / attributes.
 * Escapes `&`, `<`, `>`, `"`, and `'`. Uses `.split().join()` rather than
 * `replaceAll` to stay within the ng-packagr lib target.
 */
export function escapeHtml(value: string): string {
	return value
		.split('&')
		.join('&amp;')
		.split('<')
		.join('&lt;')
		.split('>')
		.join('&gt;')
		.split('"')
		.join('&quot;')
		.split("'")
		.join('&#39;');
}

/**
 * Validate an `img` `src` for inclusion in the print document. Only
 * `data:image/...` URLs pass through (escaped); anything else collapses to a
 * transparent 1x1 PNG so the markup stays well-formed and inert.
 */
export function safeDataImageSrc(src: string): string {
	if (typeof src !== 'string' || !src.startsWith('data:image/')) {
		return TRANSPARENT_PNG;
	}
	return escapeHtml(src);
}
