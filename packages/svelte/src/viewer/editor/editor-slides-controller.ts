import { deleteSlideAt, duplicateSlideAt, insertBlankSlideAfter } from './editor-slide-ops';
import type { EditorState } from './editor-state.svelte';

/**
 * The Home tab's Slides group (new / duplicate / delete slide), split out of
 * `EditorState` to keep it under the repo's 300-LOC budget. Every method
 * returns the new active slide index (or `null` on a no-op) so the caller
 * (the Slides group, via the host's slide-navigation callback) can move the
 * viewer to it; `EditorState` itself has no concept of "the active slide"
 * beyond the `getCurrent` dependency it already reads for element ops.
 */
export class EditorSlidesController {
	readonly #editor: EditorState;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	/** Insert a blank slide after the current one. Returns its new index, or null when not editable. */
	insertSlideAfterCurrent(): number | null {
		if (!this.#editor.editable) {
			return null;
		}
		const { slides, newIndex } = insertBlankSlideAfter(
			this.#editor.slides,
			this.#editor.currentSlideIndex,
		);
		this.#editor.commitSlides(slides);
		return newIndex;
	}

	/** Duplicate the current slide. Returns its new index, or null when not editable. */
	duplicateCurrentSlide(): number | null {
		if (!this.#editor.editable) {
			return null;
		}
		const result = duplicateSlideAt(this.#editor.slides, this.#editor.currentSlideIndex);
		if (!result) {
			return null;
		}
		this.#editor.commitSlides(result.slides);
		return result.newIndex;
	}

	/** Delete the current slide. Returns the new active index, or null (not editable / only slide). */
	deleteCurrentSlide(): number | null {
		if (!this.#editor.editable) {
			return null;
		}
		const result = deleteSlideAt(this.#editor.slides, this.#editor.currentSlideIndex);
		if (!result) {
			return null;
		}
		this.#editor.commitSlides(result.slides);
		this.#editor.selection.clear();
		return result.newIndex;
	}
}
