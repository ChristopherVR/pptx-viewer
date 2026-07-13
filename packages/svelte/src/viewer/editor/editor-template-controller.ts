import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { buildSaveSlides } from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

/** Active-layer routing for normal slide content versus inherited template elements. */
export class EditorTemplateController {
	readonly #editor: EditorState;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	activeElements(): PptxElement[] {
		const masterElements = this.#editor.masterOps.activeElements();
		if (masterElements) {
			return masterElements;
		}
		const slide = this.#editor.slides[this.#editor.currentSlideIndex];
		if (!slide) {
			return [];
		}
		return this.#editor.editTemplateMode
			? (this.#editor.templateElementsBySlideId[slide.id] ?? [])
			: slide.elements;
	}

	renderedSlides(): PptxSlide[] {
		return buildSaveSlides(this.#editor.slides, this.#editor.templateElementsBySlideId);
	}

	replace(elements: PptxElement[]): void {
		if (this.#editor.masterOps.replace(elements)) {
			return;
		}
		const slide = this.#editor.slides[this.#editor.currentSlideIndex];
		if (!slide) {
			return;
		}
		if (this.#editor.editTemplateMode) {
			this.#editor.templateElementsBySlideId = {
				...this.#editor.templateElementsBySlideId,
				[slide.id]: elements,
			};
			return;
		}
		this.#editor.slides = this.#editor.slides.map((item, index) =>
			index === this.#editor.currentSlideIndex ? { ...item, elements } : item,
		);
	}

	commit(elements: PptxElement[]): void {
		if (!this.#editor.editable) {
			return;
		}
		this.#editor.pushHistory();
		this.replace(elements);
		this.#editor.commitChange();
	}
}
