import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { cloneElementForPaste } from 'pptx-viewer-shared';

import { appendElement, newElementId } from './editor-insert';
import type { ElementBoxPatch } from './editor-mutations';
import { updateSlideNotes } from './editor-mutations';
import type { EditorState } from './editor-state.svelte';
import type { ZOrderDirection } from './editor-zorder';
import { reorderElement } from './editor-zorder';
import { remapInlineText, resolveInlineTextAutoFitHeight } from './inline-text';

const NUDGE_COALESCE_MS = 800;

/** History-integrated element and notes mutations for {@link EditorState}. */
export class EditorElementController {
	readonly #editor: EditorState;
	#lastNudgeAt = 0;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	resetNudge(): void {
		this.#lastNudgeAt = 0;
	}

	patchGeometry(id: string, box: ElementBoxPatch): void {
		this.#editor.replaceActiveElements(
			this.#editor.activeElements.map((element) =>
				element.id === id ? ({ ...element, ...box } as PptxElement) : element,
			),
		);
	}

	deleteSelected(): void {
		const ids = this.#editor.selection.ids;
		if (!this.#editor.editable || ids.length === 0 || this.#editor.selectedElements.length === 0) {
			return;
		}
		this.#editor.pushHistory();
		this.#editor.replaceActiveElements(
			this.#editor.activeElements.filter((element) => !ids.includes(element.id)),
		);
		this.#editor.selection.clear();
		this.#editor.commitChange();
	}

	duplicateSelected(): string | null {
		const source = this.#editor.selectedElement;
		if (!this.#editor.editable || !source) {
			return null;
		}
		const copy = cloneElementForPaste(source, { intoTemplate: this.#editor.editTemplateMode });
		this.#editor.pushHistory();
		this.#editor.replaceActiveElements([...this.#editor.activeElements, copy]);
		this.#editor.selection.set(copy.id);
		this.#editor.commitChange();
		return copy.id;
	}

	applyElementPatch(id: string, patch: Partial<PptxElement>): void {
		if (
			!this.#editor.editable ||
			!this.#editor.activeElements.some((element) => element.id === id)
		) {
			return;
		}
		this.#editor.pushHistory();
		this.#editor.replaceActiveElements(
			this.#editor.activeElements.map((element) =>
				element.id === id ? ({ ...element, ...patch } as PptxElement) : element,
			),
		);
		this.#editor.commitChange();
	}

	patchSelected(patch: Partial<PptxElement>): void {
		const id = this.#editor.selectedElementId;
		if (id) {
			this.applyElementPatch(id, patch);
		}
	}

	insertElement(element: PptxElement): string | null {
		const current = this.#editor.currentSlideIndex;
		if (!this.#editor.editable || !this.#editor.slides[current]) {
			return null;
		}
		const withId = { ...element, id: element.id || newElementId() } as PptxElement;
		this.#editor.pushHistory();
		this.#editor.slides = appendElement(this.#editor.slides, current, withId);
		this.#editor.selection.set(withId.id);
		this.#editor.commitChange();
		return withId.id;
	}

	reorderSelected(direction: ZOrderDirection): void {
		const id = this.#editor.selectedElementId;
		if (!this.#editor.editable || !id) {
			return;
		}
		this.#editor.pushHistory();
		const activeSlide = { id: 'active', elements: this.#editor.activeElements } as never;
		const next = reorderElement([activeSlide], 0, id, direction);
		this.#editor.replaceActiveElements(next[0].elements);
		this.#editor.commitChange();
	}

	nudgeSelected(dx: number, dy: number): void {
		const elements = this.#editor.selectedElements;
		if (elements.length === 0) {
			return;
		}
		const now = Date.now();
		if (now - this.#lastNudgeAt > NUDGE_COALESCE_MS) {
			this.#editor.pushHistory();
		}
		this.#lastNudgeAt = now;
		for (const element of elements) {
			this.patchGeometry(element.id, {
				x: element.x + dx,
				y: element.y + dy,
				width: element.width,
				height: element.height,
				rotation: element.rotation ?? 0,
			});
		}
		this.#editor.commitChange();
	}

	commitInlineText(id: string, rawText: string): void {
		const target = this.#editor.activeElements.find((element) => element.id === id);
		if (!target) {
			return;
		}
		const text = this.#editor.transformCommittedText(rawText);
		this.#editor.pushHistory();
		// `a:spAutoFit`: grow/shrink the shape to the text's natural content
		// height, the way PowerPoint does. See `resolveInlineTextAutoFitHeight`
		// for why the editor DOM node is still resolvable here.
		const editorEl =
			typeof document !== 'undefined'
				? document.querySelector<HTMLElement>('[data-inline-editor]')
				: null;
		const newHeight = resolveInlineTextAutoFitHeight(target, editorEl);
		this.#editor.replaceActiveElements(
			this.#editor.activeElements.map((element) =>
				element.id === id
					? ({
							...element,
							...remapInlineText(target, text),
							...(newHeight !== undefined ? { height: newHeight } : {}),
						} as PptxElement)
					: element,
			),
		);
		this.#editor.commitChange();
	}

	commitNotes(notes: string, notesSegments?: TextSegment[]): void {
		const current = this.#editor.currentSlideIndex;
		const slide = this.#editor.slides[current];
		if (
			!this.#editor.editable ||
			!slide ||
			(slide.notes === notes && notesSegments === undefined)
		) {
			return;
		}
		this.#editor.pushHistory();
		this.#editor.slides = updateSlideNotes(this.#editor.slides, current, notes, notesSegments);
		this.#editor.commitChange();
	}
}
