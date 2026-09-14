import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { buildSaveSlides, isTemplateElementId } from 'pptx-viewer-shared';

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

	/**
	 * The element list that OWNS `elementId`. Slide elements stay interactive
	 * while edit-template mode is on, so a mode-routed lookup handed a slide
	 * element's z-order op the template store, where it does not exist.
	 */
	elementsOwning(elementId: string): PptxElement[] {
		const masterElements = this.#editor.masterOps.activeElements();
		if (masterElements) {
			return masterElements;
		}
		const slide = this.#editor.slides[this.#editor.currentSlideIndex];
		if (!slide) {
			return [];
		}
		return isTemplateElementId(elementId)
			? (this.#editor.templateElementsBySlideId[slide.id] ?? [])
			: slide.elements;
	}

	/** Replace the element list that owns `elementId` (see {@link elementsOwning}). */
	replaceOwning(elementId: string, elements: PptxElement[]): void {
		if (this.#editor.masterOps.replace(elements)) {
			return;
		}
		const slide = this.#editor.slides[this.#editor.currentSlideIndex];
		if (!slide) {
			return;
		}
		if (isTemplateElementId(elementId)) {
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
