import { cloneSlide } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import { computed, shallowRef } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/**
 * useEditorHistory: framework-idiomatic undo/redo stack over `PptxSlide[]`.
 *
 * This is the Vue port of the React `useEditorHistory` hook, reduced to its
 * load-bearing core: an undo (`past`) and redo (`future`) stack of deep-cloned
 * slide snapshots. Unlike the React version it does **not** track canvas size
 * or template-element layers; the Vue editor foundation operates purely on the
 * `PptxSlide[]` model, so a snapshot is simply a cloned slide array.
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
	// Undo / redo stacks of deep-cloned snapshots. `shallowRef` is sufficient:
	// we always replace the whole array, never mutate it in place.
	const past = shallowRef<PptxSlide[][]>([]);
	const future = shallowRef<PptxSlide[][]>([]);

	const canUndo = computed(() => past.value.length > 0);
	const canRedo = computed(() => future.value.length > 0);

	const snapshot = (source: PptxSlide[]): PptxSlide[] => source.map(cloneSlide);

	const pushHistory = (): void => {
		const next = [...past.value, snapshot(slides.value)];
		// Bound the stack from the front when it overflows.
		if (next.length > MAX_HISTORY_ENTRIES) {
			next.shift();
		}
		past.value = next;
		// Any fresh mutation invalidates the redo branch.
		if (future.value.length > 0) {
			future.value = [];
		}
	};

	const undo = (): void => {
		if (past.value.length === 0) {
			return;
		}
		const previous = past.value[past.value.length - 1];
		// Move the current live state onto the redo stack before reverting.
		future.value = [...future.value, snapshot(slides.value)];
		past.value = past.value.slice(0, -1);
		slides.value = snapshot(previous);
	};

	const redo = (): void => {
		if (future.value.length === 0) {
			return;
		}
		const next = future.value[future.value.length - 1];
		past.value = [...past.value, snapshot(slides.value)];
		future.value = future.value.slice(0, -1);
		slides.value = snapshot(next);
	};

	const clearHistory = (): void => {
		past.value = [];
		future.value = [];
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
