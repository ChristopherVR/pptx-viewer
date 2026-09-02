/**
 * What a `ppaction://ole?verb=<n>` Action Setting can do in a browser.
 *
 * In PowerPoint the verb is dispatched to the application that owns the
 * embedded object (`-1` = the primary verb, usually Open; `0` = Edit; the
 * rest are the server's own verb table), which then takes over the screen.
 * No browser can host that, so every verb collapses onto the one thing the
 * viewer CAN do with the payload it recovered at load time: hand the embedded
 * file to the user, the same way the inspector's "Open" button for an OLE
 * object does. The click still counts as spent either way (see
 * `runPresentationAction`), so it never falls through to click-to-advance.
 *
 * Vue was the only binding that did this; React, Angular, Svelte and Vanilla
 * left the callback a no-op, so the same deck opened its spreadsheet in one
 * viewer and did nothing in the other four. The lookup lives here so the
 * five wirings are one line each.
 *
 * @module render/presentation-ole-verb
 */

import type { PptxSlide } from 'pptx-viewer-core';

import { flattenSlideElements } from './presentation-action';

/** The embedded payload an OLE verb should open, as a data-URL. */
export interface OleVerbTarget {
	elementId: string;
	/** `OlePptxElement.oleEmbeddedData`. */
	url: string;
	fileName?: string;
}

/**
 * Resolve the clicked element to the embedded file its OLE verb acts on.
 *
 * Returns `undefined` when the click carried no element id, the element is
 * not an OLE object (an action can be authored on any shape, but the verb
 * only means something on an embedding), or the embedding could not be
 * recovered at load time (`oleEmbeddedData` unset); the verb is then a
 * deliberate no-op, mirroring PowerPoint's own silence on a broken link.
 * The verb number is accepted but not consulted: every verb opens the file.
 */
export function resolveOleVerbTarget(
	slide: PptxSlide | undefined,
	elementId: string | undefined,
	_verb?: number,
): OleVerbTarget | undefined {
	if (!elementId || !slide) {
		return undefined;
	}
	const element = flattenSlideElements(slide.elements).find((entry) => entry.id === elementId);
	if (!element || element.type !== 'ole' || !element.oleEmbeddedData) {
		return undefined;
	}
	return {
		elementId,
		url: element.oleEmbeddedData,
		...(element.oleEmbeddedFileName ? { fileName: element.oleEmbeddedFileName } : {}),
	};
}
