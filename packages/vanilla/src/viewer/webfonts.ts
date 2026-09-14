/**
 * Google Fonts webfont fallback for the vanilla binding.
 *
 * A deck may reference a font family that is neither installed on the
 * reader's machine nor embedded in the .pptx (PowerPoint renders such decks
 * by silently downloading its "cloud fonts"; a browser has no equivalent).
 * When a referenced family is served by the Google Fonts API, the viewer
 * injects a `<link rel="stylesheet">` so the text renders with the intended
 * face anyway. The href resolution (a bundled-catalogue lookup) lives in
 * `pptx-viewer-shared`; this module owns only the managed `<link>` element
 * (binding-specific DOM id) that the store subscription in `PptxViewer`
 * drives. Resolution is asynchronous, so the viewer tags each run with a token
 * and a superseded deck's late result never applies.
 */

import { syncGoogleWebfontStylesheet } from 'pptx-viewer-shared';

/** DOM id of the managed `<link>` element (distinct from the other bindings'). */
export const VANILLA_GOOGLE_FONTS_LINK_ID = 'pptx-vanilla-google-fonts';

/** Create / update / remove the managed `<link>` element to match `href`. */
export function syncGoogleWebfontsLink(doc: Document, href: string | null): void {
	syncGoogleWebfontStylesheet(doc, VANILLA_GOOGLE_FONTS_LINK_ID, href);
}

/** Remove the managed `<link>` element (viewer teardown). */
export function removeGoogleWebfontsLink(doc: Document): void {
	doc.getElementById(VANILLA_GOOGLE_FONTS_LINK_ID)?.remove();
}
