import type { PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { resolveGoogleWebfontHref } from 'pptx-viewer-shared';

/**
 * Google Fonts webfont fallback for the Svelte binding.
 *
 * A deck may reference a font family that is neither installed on the
 * reader's machine nor embedded in the .pptx (PowerPoint renders such decks
 * by silently downloading its "cloud fonts"; a browser has no equivalent).
 * When a referenced family is served by the Google Fonts API, the binding
 * injects a `<link rel="stylesheet">` so the text renders with the intended
 * face anyway. The pure href resolution (a bundled-catalogue lookup) lives in
 * `pptx-viewer-shared`; this module owns only the managed `<link>` element
 * (binding-specific DOM id) that the `$effect` in `viewer-effects.svelte.ts`
 * drives.
 */

/** DOM id of the managed `<link>` element (distinct from the other bindings'). */
export const SVELTE_GOOGLE_FONTS_LINK_ID = 'pptx-svelte-google-fonts';

/** Resolve the Google Fonts href for a loaded deck (`null` when nothing needs fetching). */
export function resolveWebfontHref(
	slides: readonly PptxSlide[],
	embeddedFonts: readonly PptxEmbeddedFont[],
): Promise<string | null> {
	return resolveGoogleWebfontHref(slides ?? [], embeddedFonts ?? []);
}

/** Create / update / remove the managed `<link>` element to match `href`. */
export function syncGoogleWebfontsLink(doc: Document, href: string | null): void {
	const existing = doc.getElementById(SVELTE_GOOGLE_FONTS_LINK_ID);
	if (!href) {
		existing?.remove();
		return;
	}
	const link = existing instanceof HTMLLinkElement ? existing : doc.createElement('link');
	link.id = SVELTE_GOOGLE_FONTS_LINK_ID;
	link.rel = 'stylesheet';
	link.href = href;
	if (link !== existing) {
		doc.head.appendChild(link);
	}
}

/** Remove the managed `<link>` element (effect teardown). */
export function removeGoogleWebfontsLink(doc: Document): void {
	doc.getElementById(SVELTE_GOOGLE_FONTS_LINK_ID)?.remove();
}
