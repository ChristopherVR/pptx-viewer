import type { PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import {
	collectReferencedFontFamilies,
	fetchGoogleWebfontOutlineBytes,
	resolveGoogleWebfontHref,
	selectGoogleWebfontFamilies,
} from 'pptx-viewer-shared';
import { onScopeDispose, toValue, watchEffect } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { glyphOutlineFontCache, glyphOutlineFontsTick } from '../utils/glyph-outline-cache';

/**
 * `useGoogleWebfonts`: Vue port of the Google Fonts fallback half of the
 * React `useFontInjection` hook.
 *
 * A deck may reference a font family that is neither installed on the
 * reader's machine nor embedded in the .pptx (PowerPoint renders such decks
 * by silently downloading its "cloud fonts"; a browser has no equivalent).
 * When a referenced family is served by the Google Fonts API, this
 * composable injects a `<link rel="stylesheet">` so the text renders with
 * the intended face anyway. Candidates are matched against the bundled
 * Google Fonts catalogue (no network round-trip; session-cached) and the
 * managed `<link>` element is updated when slides or embedded fonts change
 * and removed on scope dispose.
 *
 * @param slides - Reactive source of the loaded deck's slides.
 * @param embeddedFonts - Reactive source of the parsed embedded fonts (which
 *   satisfy their families without any network fetch).
 */
export function useGoogleWebfonts(
	slides: MaybeRefOrGetter<readonly PptxSlide[]>,
	embeddedFonts: MaybeRefOrGetter<readonly PptxEmbeddedFont[]>,
): void {
	const LINK_ELEMENT_ID = 'pptx-vue-google-fonts';

	watchEffect((onCleanup) => {
		if (typeof document === 'undefined') {
			return;
		}
		let cancelled = false;
		onCleanup(() => {
			cancelled = true;
			document.getElementById(LINK_ELEMENT_ID)?.remove();
		});
		void resolveGoogleWebfontHref(toValue(slides) ?? [], toValue(embeddedFonts) ?? []).then(
			(href) => {
				if (cancelled) {
					return null;
				}
				const existing = document.getElementById(LINK_ELEMENT_ID);
				if (!href) {
					existing?.remove();
					return null;
				}
				const link =
					existing instanceof HTMLLinkElement ? existing : document.createElement('link');
				link.id = LINK_ELEMENT_ID;
				link.rel = 'stylesheet';
				link.href = href;
				if (link !== existing) {
					document.head.appendChild(link);
				}
				return href;
			},
		);
	});

	onScopeDispose(() => {
		document.getElementById(LINK_ELEMENT_ID)?.remove();
	});

	// ── Best-effort glyph-outline bytes for catalogue webfonts ───────
	// A WordArt envelope glyph (inflate/deflate/can) in a referenced (not
	// embedded) family only gets true outline warping once the ACTUAL font
	// file's bytes are fetched (the `<link>` stylesheet above carries no
	// glyph geometry, see `text-warp-outline-webfont-fetch.ts`). Additive and
	// best-effort: a failure just leaves the affine-transform fallback in
	// place. `glyphOutlineFontsTick` is bumped so `useTextWarpEnvelope`'s
	// glyph layout (which reads it) recomputes once bytes land.
	watchEffect((onCleanup) => {
		let cancelled = false;
		onCleanup(() => {
			cancelled = true;
		});
		const slidesValue = toValue(slides) ?? [];
		const embeddedFontsValue = toValue(embeddedFonts) ?? [];
		const referenced = collectReferencedFontFamilies(slidesValue);
		const candidates = selectGoogleWebfontFamilies(
			referenced,
			embeddedFontsValue.map((font) => font.name),
		);
		if (candidates.length === 0) {
			return;
		}
		void resolveGoogleWebfontHref(slidesValue, embeddedFontsValue).then(async (href) => {
			if (cancelled || !href) {
				return;
			}
			const variants: Array<{ bold: boolean; italic: boolean }> = [
				{ bold: false, italic: false },
				{ bold: true, italic: false },
			];
			let registeredAny = false;
			for (const family of candidates) {
				for (const variant of variants) {
					if (cancelled) {
						return;
					}
					const bytes = await fetchGoogleWebfontOutlineBytes(
						href,
						family,
						variant.bold,
						variant.italic,
						fetch,
					);
					if (
						bytes &&
						glyphOutlineFontCache.registerFontBytes(family, variant.bold, variant.italic, bytes)
					) {
						registeredAny = true;
					}
				}
			}
			if (registeredAny && !cancelled) {
				glyphOutlineFontsTick.value += 1;
			}
			return undefined;
		});
	});
}
