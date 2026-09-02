import { updateSlide } from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

/**
 * Slide-background actions for the ribbon's Design tab "Format Background"
 * panel, split out of `EditorState` to keep it under the repo's 300-LOC
 * budget (mirrors `EditorSlidesController` / `EditorArrangeController`).
 *
 * Solid-colour fill only (matches the docked panel's scope: a single colour
 * input); clearing removes every background field so the slide falls back to
 * its layout/master background. Both mutations route through
 * `EditorState.commitSlides`, so they are history-integrated (undoable) like
 * every other ribbon mutation.
 */
export class EditorBackgroundController {
	readonly #editor: EditorState;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	/** Set the current slide's background to a solid colour. */
	setSlideBackgroundColor(color: string): void {
		const current = this.#editor.currentSlideIndex;
		if (!this.#editor.editable || !this.#editor.slides[current]) {
			return;
		}
		this.#editor.commitSlides(
			updateSlide(this.#editor.slides, current, { backgroundColor: color }),
		);
	}

	/** Clear every background field on the current slide (fall back to layout/master). */
	clearSlideBackground(): void {
		const current = this.#editor.currentSlideIndex;
		if (!this.#editor.editable || !this.#editor.slides[current]) {
			return;
		}
		this.#editor.commitSlides(
			updateSlide(this.#editor.slides, current, {
				backgroundColor: undefined,
				backgroundImage: undefined,
				backgroundGradient: undefined,
				backgroundPattern: undefined,
			}),
		);
	}

	/** Toggle PowerPoint's "Hide Background Graphics" (`p:sld/@showMasterSp`). */
	setHideBackgroundGraphics(hide: boolean): void {
		const current = this.#editor.currentSlideIndex;
		if (!this.#editor.editable || !this.#editor.slides[current]) {
			return;
		}
		this.#editor.commitSlides(
			updateSlide(this.#editor.slides, current, { showMasterShapes: !hide }),
		);
	}
}
