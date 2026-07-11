import { copyElementToClipboard, pasteClipboardElement } from './editor-clipboard';
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
		const payload = copyElementToClipboard(this.#editor.slides, this.#editor.currentSlideIndex, id);
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
			this.#editor.slides,
			this.#editor.currentSlideIndex,
			clipboard,
		);
		if (!result) {
			return null;
		}
		this.#editor.commitSlides(result.slides);
		this.#editor.selection.set(result.newId);
		return result.newId;
	}
}
