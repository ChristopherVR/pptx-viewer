/**
 * `GoogleWebfontsService`: Angular port of the Google Fonts fallback half of
 * the React `useFontInjection` hook (mirrors the split between
 * `EmbeddedFontsService` and the shared pure helpers).
 *
 * A deck may reference a font family that is neither installed on the
 * reader's machine nor embedded in the .pptx (PowerPoint renders such decks
 * by silently downloading its "cloud fonts"; a browser has no equivalent).
 * When a referenced family is served by the Google Fonts API, this service
 * injects a `<link rel="stylesheet">` so the text renders with the intended
 * face anyway. Candidates are probed (session-cached) asynchronously, so each
 * `sync` call tags its result with a token: only the most recent call may
 * apply its outcome. The managed `<link>` element lives in a single element
 * keyed by {@link GOOGLE_WEBFONTS_LINK_ID} and is removed on destroy via
 * `DestroyRef.onDestroy` (or an explicit {@link dispose}).
 *
 * Provide at the component level alongside `EmbeddedFontsService`.
 */

import { DestroyRef, Injectable, inject } from '@angular/core';
import type { PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';

import { resolveGoogleWebfontHref } from '../internal/shared';

/** DOM id of the managed `<link>` element (binding-specific, like the style ids). */
export const GOOGLE_WEBFONTS_LINK_ID = 'pptx-angular-google-fonts';

/** True when the runtime exposes the DOM APIs we need to inject a `<link>`. */
function hasDomSupport(): boolean {
	return (
		typeof document !== 'undefined' &&
		typeof document.createElement === 'function' &&
		typeof document.head !== 'undefined'
	);
}

@Injectable()
export class GoogleWebfontsService {
	private linkEl: HTMLLinkElement | null = null;
	/** Tags in-flight probes; only the newest `sync` may apply its result. */
	private syncToken = 0;

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.dispose();
		});
	}

	/**
	 * Resolve which referenced families need a Google Fonts fetch for this
	 * deck and sync the managed `<link>` element once the probe settles.
	 * Pass empty slides / fonts (e.g. before a load) to remove it.
	 */
	sync(slides: readonly PptxSlide[], embeddedFonts: readonly PptxEmbeddedFont[]): void {
		if (!hasDomSupport()) {
			return;
		}
		const token = ++this.syncToken;
		void resolveGoogleWebfontHref(slides ?? [], embeddedFonts ?? []).then((href) => {
			if (token !== this.syncToken || !hasDomSupport()) {
				return null;
			}
			if (!href) {
				this.removeLinkElement();
				return null;
			}
			if (!this.linkEl || !this.linkEl.parentNode) {
				this.linkEl = document.createElement('link');
				this.linkEl.id = GOOGLE_WEBFONTS_LINK_ID;
				document.head.appendChild(this.linkEl);
			}
			this.linkEl.rel = 'stylesheet';
			this.linkEl.href = href;
			return href;
		});
	}

	/**
	 * Remove the injected `<link>` element and invalidate in-flight probes.
	 * Called automatically on destroy; safe to call manually.
	 */
	dispose(): void {
		this.syncToken++;
		this.removeLinkElement();
	}

	private removeLinkElement(): void {
		if (!hasDomSupport()) {
			this.linkEl = null;
			return;
		}
		const existing =
			this.linkEl ?? (document.getElementById(GOOGLE_WEBFONTS_LINK_ID) as HTMLLinkElement | null);
		existing?.parentNode?.removeChild(existing);
		this.linkEl = null;
	}
}
