import { cloneElement } from 'pptx-viewer-core';
import type { PptxLayoutOption } from 'pptx-viewer-core';
import type { SlideTemplateBuildOptions, SlideTemplateId } from 'pptx-viewer-shared';

import {
	deleteSlideAt,
	duplicateSlideAt,
	insertBlankSlideAfter,
	insertTemplateSlideAfter,
	moveSlide,
} from './editor-slide-ops';
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

	/**
	 * Insert a shared-catalogue template slide after the current one, as one
	 * undoable step (Home > Slide Templates gallery). The caller (the gallery
	 * launcher, which can read the render context) passes the deck's scheme and
	 * canvas size in `options` so the slide inherits the theme; without them
	 * the shared builder falls back to the Office default scheme at 1280x720.
	 * Returns the new index, or null when not editable.
	 */
	insertSlideFromTemplate(
		templateId: SlideTemplateId,
		options: SlideTemplateBuildOptions = {},
	): number | null {
		if (!this.#editor.editable) {
			return null;
		}
		const { slides, newIndex } = insertTemplateSlideAfter(
			this.#editor.slides,
			this.#editor.currentSlideIndex,
			templateId,
			options,
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
		const source = this.#editor.slides[this.#editor.currentSlideIndex];
		const copy = result.slides[result.newIndex];
		this.#editor.commitSlides(result.slides);
		this.#editor.templateElementsBySlideId = {
			...this.#editor.templateElementsBySlideId,
			[copy.id]: (this.#editor.templateElementsBySlideId[source.id] ?? []).map(cloneElement),
		};
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
		const removedId = this.#editor.slides[this.#editor.currentSlideIndex].id;
		this.#editor.commitSlides(result.slides);
		const templateElementsBySlideId = { ...this.#editor.templateElementsBySlideId };
		delete templateElementsBySlideId[removedId];
		this.#editor.templateElementsBySlideId = templateElementsBySlideId;
		this.#editor.selection.clear();
		return result.newIndex;
	}

	/**
	 * The layouts available for the current slide (its master's layouts),
	 * resolved via the core `getAvailableLayoutsForSlide` API. Empty when no
	 * deck is loaded. Backs the Home tab's Layout dropdown (React parity).
	 */
	async availableLayouts(): Promise<PptxLayoutOption[]> {
		const handler = this.#editor.getHandler();
		if (!handler) {
			return [];
		}
		return handler.getAvailableLayoutsForSlide(this.#editor.currentSlideIndex, this.#editor.slides);
	}

	/** Re-map the current slide onto `layoutPath`. Returns its index, or null when not editable. */
	async applyLayout(layoutPath: string): Promise<number | null> {
		if (!this.#editor.editable) {
			return null;
		}
		const handler = this.#editor.getHandler();
		if (!handler) {
			return null;
		}
		const index = this.#editor.currentSlideIndex;
		const updated = await handler.applyLayoutToSlide(index, layoutPath, this.#editor.slides);
		this.#editor.commitSlides(
			this.#editor.slides.map((slide, i) => (i === index ? updated : slide)),
		);
		return index;
	}

	/**
	 * Reset the current slide by re-applying its own layout, restoring inherited
	 * placeholder geometry/formatting (React's Home > Reset). Returns the slide
	 * index, or null when the slide has no known layout path.
	 */
	async resetSlide(): Promise<number | null> {
		const path = this.#editor.slides[this.#editor.currentSlideIndex]?.layoutPath;
		if (!path) {
			return null;
		}
		return this.applyLayout(path);
	}

	/** Move an arbitrary thumbnail slide. Returns the selected target index on success. */
	moveSlide(fromIndex: number, toIndex: number): number | null {
		if (!this.#editor.editable) {
			return null;
		}
		const slides = moveSlide(this.#editor.slides, fromIndex, toIndex);
		if (!slides) {
			return null;
		}
		this.#editor.commitSlides(slides);
		this.#editor.selection.clear();
		return toIndex;
	}
}
