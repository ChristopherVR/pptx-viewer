import { cloneSlide } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import { EditorHistory } from 'pptx-viewer-shared';
import { computed, shallowRef } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/**
 * useEditorHistory: framework-idiomatic undo/redo stack over `PptxSlide[]`.
 *
 * This is the Vue port of the React `useEditorHistory` hook, reduced to its
 * load-bearing core: an undo / redo stack of deep-cloned slide snapshots.
 * Unlike the React version it does **not** track canvas size or
 * template-element layers; the Vue editor foundation operates purely on the
 * `PptxSlide[]` model, so a snapshot is simply a cloned slide array.
 *
 * The stack itself is the shared, framework-agnostic `EditorHistory<T>` command
 * stack (`pptx-viewer-shared`); this composable adds only the Vue reactivity
 * (`computed` canUndo/canRedo) and the `cloneSlide` deep-snapshotting the shared
 * class deliberately leaves to the caller.
 *
 * Usage pattern (push-before-mutate):
 *
 * ```ts
 * const slides = shallowRef<PptxSlide[]>([]);
 * const history = useEditorHistory(slides);
 *
 * // before any mutation that should be undoable:
 * history.pushHistory();
 * slides.value = nextSlides;
 * ```
 *
 * `pushHistory` snapshots the *current* slide state onto the past stack and
 * clears the redo stack; callers invoke it immediately before committing a new
 * `slides.value`. `undo`/`redo` swap snapshots in and out of the live ref.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cap the past stack to bound memory; mirrors the React `MAX_HISTORY_ENTRIES`. */
const MAX_HISTORY_ENTRIES = 120;

// ---------------------------------------------------------------------------
// Result interface
// ---------------------------------------------------------------------------

export interface EditorHistoryResult {
	/** True when there is at least one snapshot to undo to. */
	canUndo: ComputedRef<boolean>;
	/** True when there is at least one snapshot to redo to. */
	canRedo: ComputedRef<boolean>;
	/**
	 * Snapshot the current `slides.value` onto the undo stack and clear the redo
	 * stack. Call this immediately **before** committing a mutating change.
	 */
	pushHistory: () => void;
	/** Revert to the previous snapshot, pushing the current state onto redo. */
	undo: () => void;
	/** Re-apply the next snapshot, pushing the current state back onto undo. */
	redo: () => void;
	/** Drop all undo/redo history (e.g. when new content is loaded). */
	clearHistory: () => void;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * @param slides Reactive reference to the live slide array the editor mutates.
 *               A `shallowRef` is recommended for large decks.
 */
export function useEditorHistory(slides: Ref<PptxSlide[]>): EditorHistoryResult {
	// The shared, framework-agnostic command stack. It performs no cloning, so we
	// snapshot with `cloneSlide` before every record/undo/redo round-trip.
	const stack = new EditorHistory<PptxSlide[]>({ maxDepth: MAX_HISTORY_ENTRIES });

	// A monotonically-increasing tick bumped on every mutation so the `computed`
	// flags below re-evaluate against the (non-reactive) shared stack.
	const tick = shallowRef(0);
	const bump = (): void => {
		tick.value++;
	};

	const snapshot = (source: PptxSlide[]): PptxSlide[] => source.map(cloneSlide);

	const canUndo = computed(() => {
		void tick.value;
		return stack.canUndo;
	});
	const canRedo = computed(() => {
		void tick.value;
		return stack.canRedo;
	});

	const pushHistory = (): void => {
		stack.record(snapshot(slides.value), '');
		bump();
	};

	const undo = (): void => {
		const result = stack.undo(snapshot(slides.value));
		if (!result) {
			return;
		}
		slides.value = snapshot(result.snapshot);
		bump();
	};

	const redo = (): void => {
		const result = stack.redo(snapshot(slides.value));
		if (!result) {
			return;
		}
		slides.value = snapshot(result.snapshot);
		bump();
	};

	const clearHistory = (): void => {
		stack.clear();
		bump();
	};

	return {
		canUndo,
		canRedo,
		pushHistory,
		undo,
		redo,
		clearHistory,
	};
}
