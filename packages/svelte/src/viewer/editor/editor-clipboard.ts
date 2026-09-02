import type { PptxSlide } from 'pptx-viewer-core';
import type { ElementClipboardPayload } from 'pptx-viewer-shared';
import {
	buildElementClipboardPayload,
	cloneElementForPaste,
	findSlideElement,
	mapSlideElements,
} from 'pptx-viewer-shared';

/**
 * Pure clipboard mutations for the Svelte editor's Ctrl+C/X/V and Home tab
 * Clipboard group. The reusable, framework-agnostic payload shape and clone
 * logic (fresh id, small paste offset) live in the shared
 * `render/element-clipboard` module; this file only lifts them to the
 * slide-array shape `EditorState` stores, mirroring `editor-mutations.ts`.
 */

/** Build a clipboard payload from the element with `elementId`, or `null`. */
export function copyElementToClipboard(
	slides: readonly PptxSlide[],
	slideIndex: number,
	elementId: string,
): ElementClipboardPayload | null {
	const source = findSlideElement(slides, slideIndex, elementId);
	return source ? buildElementClipboardPayload(source, false) : null;
}

/**
 * Clone the clipboard payload's element (fresh id, offset) and append it to
 * the given slide. Returns the new slide array plus the copy's id.
 */
export function pasteClipboardElement(
	slides: readonly PptxSlide[],
	slideIndex: number,
	payload: ElementClipboardPayload,
	intoTemplate = false,
): { slides: PptxSlide[]; newId: string } | null {
	if (!slides[slideIndex]) {
		return null;
	}
	const copy = cloneElementForPaste(payload.element, { intoTemplate });
	return {
		slides: mapSlideElements(slides, slideIndex, (elements) => [...elements, copy]),
		newId: copy.id,
	};
}
