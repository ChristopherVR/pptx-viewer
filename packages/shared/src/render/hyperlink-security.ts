/**
 * Hyperlink security utilities — URL validation, sanitization, and slide-jump
 * resolution for hyperlink click actions in the viewer. Pure, framework-agnostic
 * logic shared by every binding (React / Vue / Angular).
 *
 * `safeOpenUrl` touches `window`/`console` but guards both, so it is safe to
 * call from non-DOM contexts (it simply no-ops/returns `false`).
 */

// ---------------------------------------------------------------------------
// Blocked protocols — URLs using these schemes will be rejected to prevent
// XSS, code injection, or data exfiltration. Built without the literal
// `javascript:` token to satisfy the no-script-url lint rule.
// ---------------------------------------------------------------------------

const BLOCKED_PROTOCOLS = new Set([
	`${'javascript'}:`,
	'data:',
	'vbscript:',
	'mhtml:',
	`x-]${'javascript'}:`,
]);

/**
 * Check whether a URL is safe to open / expose as an `href`.
 *
 * Blocks `javascript:`, `data:`, `vbscript:`, and `mhtml:` protocols
 * (case- and whitespace/zero-width-bypass resistant). Returns `true` for
 * `http:`, `https:`, `mailto:`, `tel:`, `ftp:`, and relative URLs.
 */
export function isUrlSafe(url: string | undefined): boolean {
	if (!url || typeof url !== 'string') {
		return false;
	}

	const trimmed = url.trim();
	if (trimmed.length === 0) {
		return false;
	}

	// Normalize: lowercase to catch case-bypasses like "JaVaScRiPt:"
	const lower = trimmed.toLowerCase();

	// Strip whitespace and zero-width characters that could bypass naive checks.
	// Characters stripped: ZWSP (​), ZWNJ (‌), ZWJ (‍), BOM (﻿), NUL.
	// Separate replace calls avoid no-misleading-character-class (joined sequences)
	// and no-control-regex (NUL literal) lint rules.
	const stripped = lower
		.replace(/[\s​﻿]/gu, '')
		.replace(/‌/gu, '')
		.replace(/‍/gu, '')
		.split(String.fromCharCode(0))
		.join('');

	for (const protocol of BLOCKED_PROTOCOLS) {
		if (stripped.startsWith(protocol)) {
			return false;
		}
	}

	return true;
}

/**
 * Open a URL in a new browser tab/window with security attributes.
 *
 * - Validates the URL against blocked protocols
 * - Opens with `noopener,noreferrer` to prevent reverse-tabnabbing
 * - Returns `true` if the URL was opened, `false` if blocked / unavailable
 */
export function safeOpenUrl(url: string): boolean {
	if (!isUrlSafe(url)) {
		if (typeof console !== 'undefined') {
			console.warn(`[pptx-viewer] Blocked attempt to open unsafe URL: ${url.slice(0, 100)}`);
		}
		return false;
	}
	if (typeof window === 'undefined') {
		return false;
	}
	window.open(url, '_blank', 'noopener,noreferrer');
	return true;
}

/**
 * Clamp a slide index to the valid range `[0, totalSlides - 1]`.
 *
 * Returns `null` if `totalSlides` is 0 or negative.
 */
export function clampSlideIndex(index: number, totalSlides: number): number | null {
	if (totalSlides <= 0) {
		return null;
	}
	if (!Number.isFinite(index)) {
		return null;
	}
	return Math.max(0, Math.min(totalSlides - 1, Math.floor(index)));
}

/**
 * Resolve an `ElementActionType` to a concrete slide index.
 *
 * @param actionType - The high-level action type
 * @param currentSlideIndex - Current slide (for next/prev)
 * @param totalSlides - Total number of slides
 * @param targetSlideIndex - Explicit target index (for "slide" type)
 * @returns The resolved slide index, `"endShow"` for ending the presentation,
 *          or `null` if no navigation is needed.
 */
export function resolveSlideJump(
	actionType: string,
	currentSlideIndex: number,
	totalSlides: number,
	targetSlideIndex?: number,
): number | 'endShow' | null {
	switch (actionType) {
		case 'slide':
			if (typeof targetSlideIndex === 'number') {
				return clampSlideIndex(targetSlideIndex, totalSlides);
			}
			return null;
		case 'firstSlide':
			return 0;
		case 'lastSlide':
			return totalSlides > 0 ? totalSlides - 1 : null;
		case 'nextSlide':
			return clampSlideIndex(currentSlideIndex + 1, totalSlides);
		case 'prevSlide':
			return clampSlideIndex(currentSlideIndex - 1, totalSlides);
		case 'endShow':
			return 'endShow';
		case 'none':
		case 'url':
		default:
			return null;
	}
}

/**
 * Check whether a URL string is a PowerPoint internal action URL
 * (`ppaction://hlinksldjump`, `ppaction://hlinkshowjump`, etc.).
 */
export function isPpactionUrl(url: string | undefined): boolean {
	if (!url || typeof url !== 'string') {
		return false;
	}
	return url.toLowerCase().startsWith('ppaction://');
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

/**
 * Parsed result from a `ppaction://` URL passed through text-level
 * hyperlink click handlers. The URL may have an encoded `slideIndex`
 * query parameter for internal slide jump targets.
 */
export interface ParsedPpaction {
	/** The original action string (e.g. `ppaction://hlinksldjump`). */
	action: string;
	/** Zero-based target slide index (from encoded query parameter). */
	targetSlideIndex?: number;
}

/**
 * Parse a `ppaction://` URL string that may contain an encoded
 * `slideIndex` query parameter.
 *
 * Text-level hyperlinks encode slide jump targets as
 * `ppaction://hlinksldjump?slideIndex=<n>` so the target index can
 * travel through the `onHyperlinkClick(url)` callback without
 * changing its signature.
 *
 * The `action` field in the result contains the original action URL
 * with only the synthetic `slideIndex` parameter removed (preserving
 * any other query parameters like `?jump=nextslide` for hlinkshowjump).
 *
 * Returns `null` if the URL is not a `ppaction://` URL.
 */
export function parsePpactionUrl(url: string): ParsedPpaction | null {
	if (!isPpactionUrl(url)) {
		return null;
	}

	let targetSlideIndex: number | undefined;

	const qIndex = url.indexOf('?');
	if (qIndex >= 0) {
		const queryStr = url.slice(qIndex + 1);
		const params = new URLSearchParams(queryStr);
		const slideIndexStr = params.get('slideIndex');
		if (slideIndexStr !== null) {
			const parsed = parseInt(slideIndexStr, 10);
			if (Number.isFinite(parsed)) {
				targetSlideIndex = parsed;
			}
		}
		// Remove the synthetic slideIndex parameter to reconstruct the
		// original action string.
		params.delete('slideIndex');
		const remaining = params.toString();
		const action = remaining ? `${url.slice(0, qIndex)}?${remaining}` : url.slice(0, qIndex);
		return { action, targetSlideIndex };
	}

	return { action: url, targetSlideIndex };
}
