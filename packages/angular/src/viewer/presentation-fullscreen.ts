/**
 * presentation-fullscreen.ts
 *
 * DOM-only helpers that drive the real browser Fullscreen API for the
 * presentation overlay. Kept Angular-free so they can be unit-tested without
 * TestBed (mirrors `presentation-overlay-helpers.ts`).
 *
 * Mirrors the React (`usePresentationMode.ts`) and Vue (`PresentationMode.vue`)
 * implementations: request fullscreen on the overlay's own root element when it
 * mounts, exit fullscreen when it unmounts, and feature-detect throughout so
 * browsers/environments without full Fullscreen API support (iOS Safari's
 * partial support, jsdom in tests, etc.) degrade silently to the CSS-fixed
 * overlay rather than throwing.
 */

/** An element augmented with the (still not universally supported) Fullscreen API. */
type FullscreenCapableElement = HTMLElement & {
	requestFullscreen?: () => Promise<void>;
};

/** A document augmented with the Fullscreen API's exit/state members. */
type FullscreenCapableDocument = Document & {
	fullscreenElement?: Element | null;
	exitFullscreen?: () => Promise<void>;
};

/**
 * Request fullscreen on `element` if the Fullscreen API is available.
 * No-ops (rather than throwing) when the element is missing, the API is
 * unsupported, or the browser rejects the request (no active user gesture,
 * permission denied, etc.).
 */
export function requestPresentationFullscreen(element: HTMLElement | null | undefined): void {
	if (!element) {
		return;
	}
	const el = element as FullscreenCapableElement;
	if (typeof el.requestFullscreen !== 'function') {
		return;
	}
	try {
		void el.requestFullscreen().catch(() => {
			/* ignore: denied, unsupported, or no active user gesture */
		});
	} catch {
		/* ignore: some environments throw synchronously instead of rejecting */
	}
}

/**
 * Exit fullscreen if the given document is currently in it and the Fullscreen
 * API is available. No-ops otherwise.
 */
export function exitPresentationFullscreen(doc: Document | null | undefined): void {
	if (!doc) {
		return;
	}
	const d = doc as FullscreenCapableDocument;
	if (!d.fullscreenElement || typeof d.exitFullscreen !== 'function') {
		return;
	}
	try {
		void d.exitFullscreen().catch(() => {
			/* ignore */
		});
	} catch {
		/* ignore */
	}
}

/**
 * Whether `doc` is currently NOT in fullscreen (i.e. fullscreen was just
 * exited, or was never entered, e.g. because the API is unsupported).
 *
 * Fed a `fullscreenchange` event on `document`; combined with the overlay's
 * own "did I just cause this?" guard, distinguishes an external exit (Esc
 * consumed by the browser before reaching the overlay's own keydown handler,
 * the Android back gesture, swiping away on iOS) from our own close flow.
 */
export function hasExitedFullscreen(doc: Document | null | undefined): boolean {
	const d = doc as FullscreenCapableDocument | null | undefined;
	return !d?.fullscreenElement;
}
