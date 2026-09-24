import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { ElementClipboardPayload, PasteSpecialFormat } from 'pptx-viewer-shared';
import {
	applyPasteSpecialFormat,
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

/**
 * Paste Special (Ctrl+Alt+V) / the dialog's OK: clone the clipboard payload
 * and insert it with `format` already applied. Returns the inserted element's
 * own pristine "Keep Source Formatting" clone alongside it, so the Paste
 * Options toolbar can re-derive from it non-cumulatively later.
 */
export function pasteClipboardElementWithFormat(
	slides: readonly PptxSlide[],
	slideIndex: number,
	payload: ElementClipboardPayload,
	format: PasteSpecialFormat,
	intoTemplate = false,
): { slides: PptxSlide[]; id: string; sourceClone: PptxElement } | null {
	if (!slides[slideIndex]) {
		return null;
	}
	const sourceClone = cloneElementForPaste(payload.element, { intoTemplate });
	// "Picture" is inserted as the plain clone first (there is nothing to
	// rasterize before it is mounted); every other format applies immediately.
	const inserted =
		format === 'picture' ? sourceClone : applyPasteSpecialFormat(sourceClone, format);
	return {
		slides: mapSlideElements(slides, slideIndex, (elements) => [...elements, inserted]),
		id: inserted.id,
		sourceClone,
	};
}

/** Replace one element by id on `slideIndex` (Paste Options toolbar / picture rasterize). */
export function replaceSlideElement(
	slides: readonly PptxSlide[],
	slideIndex: number,
	elementId: string,
	next: PptxElement,
): PptxSlide[] {
	return mapSlideElements(slides, slideIndex, (elements) =>
		elements.map((el) => (el.id === elementId ? next : el)),
	);
}
