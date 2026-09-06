/**
 * What a `ppaction://ole?verb=<n>` Action Setting can do in a browser.
 *
 * In PowerPoint the verb is dispatched to the application that owns the
 * embedded object (`-1` = the primary verb, usually Open/Edit; the rest are
 * the server's own verb table per [MS-OLEDS] SS2.3.10), which then takes over
 * the screen. No browser can host a foreign application in-place, so this
 * classifies the verb into the closest available action instead of
 * collapsing every verb onto the same "open the file" behaviour:
 *
 * - A generic "Package" object (arbitrary embedded file, no in-place editor)
 *   always resolves to `'download'`: there is nothing to edit or preview in
 *   place, matching PowerPoint's own Packager, which just launches the
 *   registered handler for the file.
 * - A verb from the "Show"/secondary-display family (`1`, `-2`) resolves to
 *   `'preview'`.
 * - The primary verb (`-1`), `Open`/`Edit` (`0`), and any other/unspecified
 *   verb resolve to `'edit'`: the in-viewer OLE content editor when authoring
 *   the deck, or a read-only preview when the caller is a running
 *   presentation (editing mid-show is not offered; see each binding's
 *   presentation-mode action runner, which downgrades `'edit'` to a preview
 *   there).
 *
 * The click still counts as spent either way (see `runPresentationAction`),
 * so it never falls through to click-to-advance.
 *
 * @module render/presentation-ole-verb
 */

import type { PptxSlide } from 'pptx-viewer-core';

import { flattenSlideElements } from './presentation-action';

/** The action an OLE verb resolves to in a browser (see module doc). */
export type OleVerbAction = 'edit' | 'preview' | 'download';

/** Verbs from the "Show"/secondary-display family (best-effort per [MS-OLEDS]; server verb tables vary). */
const SHOW_VERBS: ReadonlySet<number> = new Set([1, -2]);

/** The embedded payload an OLE verb should act on, as a data-URL, plus the resolved action. */
export interface OleVerbTarget {
	elementId: string;
	/** `OlePptxElement.oleEmbeddedData`. */
	url: string;
	fileName?: string;
	action: OleVerbAction;
}

/**
 * Resolve the clicked element to the embedded file its OLE verb acts on, and
 * classify the verb into the action a browser can actually perform (see
 * module doc for the mapping).
 *
 * Returns `undefined` when the click carried no element id, the element is
 * not an OLE object (an action can be authored on any shape, but the verb
 * only means something on an embedding), or the embedding could not be
 * recovered at load time (`oleEmbeddedData` unset); the verb is then a
 * deliberate no-op, mirroring PowerPoint's own silence on a broken link.
 */
export function resolveOleVerbTarget(
	slide: PptxSlide | undefined,
	elementId: string | undefined,
	verb?: number,
): OleVerbTarget | undefined {
	if (!elementId || !slide) {
		return undefined;
	}
	const element = flattenSlideElements(slide.elements).find((entry) => entry.id === elementId);
	if (!element || element.type !== 'ole' || !element.oleEmbeddedData) {
		return undefined;
	}
	const action: OleVerbAction =
		element.oleObjectType === 'package'
			? 'download'
			: verb !== undefined && SHOW_VERBS.has(verb)
				? 'preview'
				: 'edit';
	return {
		elementId,
		url: element.oleEmbeddedData,
		...(element.oleEmbeddedFileName ? { fileName: element.oleEmbeddedFileName } : {}),
		action,
	};
}
