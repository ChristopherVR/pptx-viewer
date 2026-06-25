import type { PptxSlide } from 'pptx-viewer-core';
import { cloneSlide } from 'pptx-viewer-core';
import type { Ref } from 'vue';

/**
 * `useSlideOperations`: slide-level CRUD for the Vue editor.
 *
 * Vue port of the slide-management subset of the React
 * `useSlideManagement` hook. Each operation snapshots undo/redo history
 * *first* (via the supplied `pushHistory`) and then reassigns
 * `slides.value` with a fresh array so that `shallowRef`-backed slide
 * state triggers reactivity. `activeSlideIndex` is adjusted to keep a
 * sensible slide focused after the mutation.
 *
 * Blank slides are created via a minimal object literal matching the
 * `PptxSlide` shape (the same approach the React `handleAddSlide` uses):
 * a fresh `id`, empty `rId`, `slideNumber` and an empty `elements` array.
 * Duplication reuses the framework-agnostic `cloneSlide` helper from
 * `pptx-viewer-core` for a deep, reference-independent copy.
 */
export interface UseSlideOperationsInput {
	/** Reactive slide list (typically a `shallowRef<PptxSlide[]>`). */
	slides: Ref<PptxSlide[]>;
	/** Index of the currently focused slide. */
	activeSlideIndex: Ref<number>;
	/** Snapshot current state onto the undo stack before mutating. */
	pushHistory: () => void;
}

export interface UseSlideOperationsResult {
	/** Insert a blank slide directly after the active slide. */
	addSlide: () => void;
	/** Remove the slide at `index` (no-op when only one slide remains). */
	deleteSlide: (index: number) => void;
	/** Deep-clone the slide at `index` and insert the copy right after it. */
	duplicateSlide: (index: number) => void;
	/** Reorder the slide at `from` to position `to`. */
	moveSlide: (from: number, to: number) => void;
}

/** Generate a collision-resistant slide id. */
function makeSlideId(): string {
	return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Build a fresh, empty {@link PptxSlide}. */
function createBlankSlide(slideNumber: number): PptxSlide {
	return {
		id: makeSlideId(),
		rId: '',
		slideNumber,
		elements: [],
	};
}

export function useSlideOperations(input: UseSlideOperationsInput): UseSlideOperationsResult {
	const { slides, activeSlideIndex, pushHistory } = input;

	const addSlide = (): void => {
		pushHistory();
		const next = [...slides.value];
		const insertAt = Math.max(0, Math.min(activeSlideIndex.value + 1, next.length));
		next.splice(insertAt, 0, createBlankSlide(next.length + 1));
		slides.value = next;
		activeSlideIndex.value = insertAt;
	};

	const deleteSlide = (index: number): void => {
		if (slides.value.length <= 1 || index < 0 || index >= slides.value.length) {
			return;
		}
		pushHistory();
		const next = [...slides.value];
		next.splice(index, 1);
		slides.value = next;
		activeSlideIndex.value = Math.max(0, Math.min(activeSlideIndex.value, next.length - 1));
	};

	const duplicateSlide = (index: number): void => {
		if (index < 0 || index >= slides.value.length) {
			return;
		}
		pushHistory();
		const source = slides.value[index];
		const copy: PptxSlide = { ...cloneSlide(source), id: makeSlideId() };
		const next = [...slides.value];
		next.splice(index + 1, 0, copy);
		slides.value = next;
		activeSlideIndex.value = index + 1;
	};

	const moveSlide = (from: number, to: number): void => {
		const length = slides.value.length;
		if (from === to || from < 0 || from >= length || to < 0 || to >= length) {
			return;
		}
		pushHistory();
		const next = [...slides.value];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		slides.value = next;
		activeSlideIndex.value = to;
	};

	return { addSlide, deleteSlide, duplicateSlide, moveSlide };
}
