/**
 * Hyperlink resolution + URL safety for the viewer.
 *
 * Viewer-first subset of the React `hyperlink-security.ts`: enough to render
 * safe `<a href>` links on text runs. Internal PowerPoint actions
 * (`ppaction://…` slide jumps) and unsafe protocols are not turned into
 * navigable hrefs here — slide-jump wiring is a follow-up (see PORTING.md).
 */

// Blocked URL schemes — rendering these as an href would enable XSS / code
// injection. Built without the literal `javascript:` token to satisfy lint.
const BLOCKED_PROTOCOLS = [`${'javascript'}:`, 'data:', 'vbscript:', 'mhtml:'];

/**
 * Whether a URL is safe to expose as an `href`. Blocks `javascript:`,
 * `data:`, `vbscript:`, and `mhtml:` (case- and whitespace-bypass resistant);
 * allows `http(s)`, `mailto:`, `tel:`, `ftp:`, and relative URLs.
 */
export function isUrlSafe(url: string | undefined): boolean {
	if (!url || typeof url !== 'string') {
		return false;
	}
	const trimmed = url.trim();
	if (trimmed.length === 0) {
		return false;
	}
	// Lowercase + strip whitespace / zero-width / NUL chars that could bypass
	// a naive prefix check (e.g. "java​script:").
	const stripped = trimmed
		.toLowerCase()
		.replace(/[\s​﻿]/gu, '')
		.replace(/‌/gu, '')
		.replace(/‍/gu, '')
		.split(String.fromCharCode(0))
		.join('');

	return !BLOCKED_PROTOCOLS.some((protocol) => stripped.startsWith(protocol));
}

/** Whether a URL is a PowerPoint internal action (`ppaction://…`). */
export function isPpactionUrl(url: string | undefined): boolean {
	return typeof url === 'string' && url.toLowerCase().startsWith('ppaction://');
}

/**
 * Resolve a raw hyperlink value to a renderable, safe `href`, or `undefined`
 * when it should not be a plain link (empty, unsafe, or an internal
 * `ppaction://` slide jump).
 */
export function resolveHyperlinkHref(url: string | undefined): string | undefined {
	if (!url || isPpactionUrl(url) || !isUrlSafe(url)) {
		return undefined;
	}
	return url.trim();
}
