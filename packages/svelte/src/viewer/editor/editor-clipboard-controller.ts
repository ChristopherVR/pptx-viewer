import type { PptxElement } from 'pptx-viewer-core';
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import { applyPasteSpecialFormat } from 'pptx-viewer-shared';

import {
	copyElementToClipboard,
	pasteClipboardElement,
	pasteClipboardElementWithFormat,
	replaceSlideElement,
} from './editor-clipboard';
import type { EditorState } from './editor-state.svelte';

/**
 * Ctrl+C/X/V and the Home tab's Clipboard group, split out of `EditorState`
 * to keep it under the repo's 300-LOC budget. Operates entirely through
 * `EditorState`'s public surface (`slides`, `selection`, `currentSlideIndex`,
 * `commitSlides`), the same contract a component would use.
 */
export class EditorClipboardController {
	readonly #editor: EditorState;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	/** Copy the primary selected element to the clipboard (works read-only, like React). */
	copySelected(): void {
		const id = this.#editor.selectedElementId;
		if (!id) {
			return;
		}
		const payload = copyElementToClipboard(
			[{ id: 'active', elements: this.#editor.activeElements } as EditorState['slides'][number]],
			0,
			id,
		);
		if (payload) {
			this.#editor.clipboard = payload;
		}
	}

	/** Copy the primary selected element then delete it (with history). */
	cutSelected(): void {
		if (!this.#editor.editable) {
			return;
		}
		this.copySelected();
		this.#editor.deleteSelected();
	}

	/** Paste the clipboard payload onto the current slide (fresh id, offset, selects it). */
	pasteClipboard(): string | null {
		const clipboard = this.#editor.clipboard;
		if (!this.#editor.editable || !clipboard) {
			return null;
		}
		const result = pasteClipboardElement(
			[{ id: 'active', elements: this.#editor.activeElements } as EditorState['slides'][number]],
			0,
			clipboard,
			this.#editor.editTemplateMode,
		);
		if (!result) {
			return null;
		}
		this.#editor.commitActiveElements(result.slides[0].elements);
		this.#editor.selection.set(result.newId);
		// A plain paste IS "Keep Source Formatting": the clone is its own
		// pristine source, so the Paste Options toolbar's later choices always
		// re-derive from it, never from an already-transformed element.
		const pasted = result.slides[0].elements.find((el) => el.id === result.newId);
		if (pasted) {
			this.#editor.pasteOptionsToolbar = [{ id: pasted.id, sourceClone: pasted }];
		}
		return result.newId;
	}

	/**
	 * Paste Special (Ctrl+Alt+V) / the dialog's OK: paste the clipboard with
	 * `format` already applied.
	 */
	pasteWithFormat(format: PasteSpecialFormat): string | null {
		const clipboard = this.#editor.clipboard;
		if (!this.#editor.editable || !clipboard) {
			return null;
		}
		const result = pasteClipboardElementWithFormat(
			[{ id: 'active', elements: this.#editor.activeElements } as EditorState['slides'][number]],
			0,
			clipboard,
			format,
			this.#editor.editTemplateMode,
		);
		if (!result) {
			return null;
		}
		this.#editor.commitActiveElements(result.slides[0].elements);
		this.#editor.selection.set(result.id);
		this.#editor.pasteOptionsToolbar = [{ id: result.id, sourceClone: result.sourceClone }];
		return result.id;
	}

	/**
	 * Re-derive an already-pasted element (the Paste Options toolbar) from its
	 * own pristine source clone. Non-cumulative: every choice starts over from
	 * the clone `pasteClipboard`/`pasteWithFormat` recorded, matching
	 * PowerPoint's own toolbar. "Picture" is handled by the caller (it needs a
	 * DOM rasterize step this controller does not perform) via `replaceElement`.
	 */
	reformatPasted(elementId: string, sourceClone: PptxElement, format: PasteSpecialFormat): void {
		if (format === 'picture') {
			return;
		}
		const next = applyPasteSpecialFormat(sourceClone, format);
		this.replaceElement(elementId, next);
	}

	/** Replace one element by id, e.g. after rasterizing it to a picture. */
	replaceElement(elementId: string, next: PptxElement): void {
		this.#editor.commitActiveElements(
			replaceSlideElement(
				[{ id: 'active', elements: this.#editor.activeElements } as EditorState['slides'][number]],
				0,
				elementId,
				next,
			)[0].elements,
		);
	}
}
