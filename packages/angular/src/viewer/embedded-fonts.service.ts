/**
 * `EmbeddedFontsService` — Angular port of the Vue `useEmbeddedFonts`
 * composable (the `@font-face` half of the React `useFontInjection` hook).
 *
 * Given the embedded fonts parsed out of a `.pptx` by `pptx-viewer-core`, this
 * service builds `@font-face` CSS rules and injects them into a single managed
 * `<style>` element appended to `<head>`, so slides render with the typefaces
 * the author embedded. The pure string-building / format-mapping logic lives in
 * `./embedded-fonts-helpers`; this service owns only the DOM side effects and
 * the signal surface.
 *
 * Lifecycle mirrors `LoadContentService`: any object URLs minted from
 * de-obfuscated font bytes are tracked and revoked when superseded, and the
 * injected `<style>` plus all live object URLs are torn down on destroy via
 * `DestroyRef.onDestroy` (or an explicit {@link dispose}).
 *
 * Provide at the component level so its lifetime tracks the host viewer:
 * `@Component({ providers: [EmbeddedFontsService] })`.
 */

import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { PptxEmbeddedFont } from 'pptx-viewer-core';

import { EMBEDDED_FONTS_STYLE_ID, buildEmbeddedFontStyles } from './embedded-fonts-helpers';
import type { ObjectUrlFactory } from './embedded-fonts-helpers';

/** True when the runtime exposes the DOM APIs we need to inject a `<style>`. */
function hasDomSupport(): boolean {
	return (
		typeof document !== 'undefined' &&
		typeof document.createElement === 'function' &&
		typeof document.head !== 'undefined'
	);
}

/** True when the runtime exposes the object-URL + `Blob` APIs we need. */
function hasObjectUrlSupport(): boolean {
	return (
		typeof URL !== 'undefined' &&
		typeof URL.createObjectURL === 'function' &&
		typeof URL.revokeObjectURL === 'function' &&
		typeof Blob !== 'undefined'
	);
}

@Injectable()
export class EmbeddedFontsService {
	/** The generated `@font-face` stylesheet text (also injected into `<head>`). */
	readonly fontFaceCss = signal('');
	/**
	 * Distinct CSS `font-family` strings for the embedded families, each with
	 * substitution fallbacks resolved (e.g. `'"Calibri", "Carlito", …'`).
	 */
	readonly fontFamilies = signal<string[]>([]);

	private styleEl: HTMLStyleElement | null = null;
	/** Object URLs minted on the most recent `setFonts`; revoked when superseded. */
	private liveObjectUrls: string[] = [];

	/** Mints a Blob object URL for de-obfuscated font bytes (impure side effect). */
	private readonly mintObjectUrl: ObjectUrlFactory = (bytes, mime) => {
		if (!hasObjectUrlSupport()) {
			return null;
		}
		// Copy into a fresh, plain-`ArrayBuffer`-backed view so the `Blob` part
		// type is satisfied (a `Uint8Array` over a `SharedArrayBuffer` is not a
		// `BlobPart`).
		const blobBytes = new Uint8Array(bytes.length);
		blobBytes.set(bytes);
		const blob = new Blob([blobBytes], { type: mime });
		return URL.createObjectURL(blob);
	};

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.dispose();
		});
	}

	/**
	 * Resolve the supplied embedded fonts into `@font-face` rules, inject them
	 * into the managed `<style>` element, and update the exposed signals.
	 *
	 * Object URLs minted on the *previous* call are revoked here so they don't
	 * leak across re-parses. Pass an empty list (or `null`) to clear everything.
	 */
	setFonts(fonts: readonly PptxEmbeddedFont[] | null | undefined): void {
		const previousUrls = this.liveObjectUrls;
		const { fontFaceCss, fontFamilies, objectUrls } = buildEmbeddedFontStyles(
			fonts,
			this.mintObjectUrl,
		);
		this.liveObjectUrls = objectUrls;
		this.revokeObjectUrls(previousUrls);

		this.fontFaceCss.set(fontFaceCss);
		this.fontFamilies.set(fontFamilies);
		this.syncStyleElement(fontFaceCss);
	}

	/**
	 * Remove the injected `<style>` element, revoke all live object URLs, and
	 * reset the signals. Called automatically on destroy; safe to call manually.
	 */
	dispose(): void {
		this.removeStyleElement();
		this.revokeObjectUrls(this.liveObjectUrls);
		this.liveObjectUrls = [];
		this.fontFaceCss.set('');
		this.fontFamilies.set([]);
	}

	/** Create / update / remove the managed `<style>` element to match `css`. */
	private syncStyleElement(css: string): void {
		if (!hasDomSupport()) {
			return;
		}
		if (css.length === 0) {
			this.removeStyleElement();
			return;
		}
		if (!this.styleEl) {
			this.styleEl = document.createElement('style');
			this.styleEl.id = EMBEDDED_FONTS_STYLE_ID;
			document.head.appendChild(this.styleEl);
		}
		this.styleEl.textContent = css;
	}

	private removeStyleElement(): void {
		if (this.styleEl && this.styleEl.parentNode) {
			this.styleEl.parentNode.removeChild(this.styleEl);
		}
		this.styleEl = null;
	}

	private revokeObjectUrls(urls: readonly string[]): void {
		if (!hasObjectUrlSupport()) {
			return;
		}
		for (const url of urls) {
			URL.revokeObjectURL(url);
		}
	}
}
