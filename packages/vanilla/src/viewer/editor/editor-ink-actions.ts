import type { StrokeToInkElementOpts } from 'pptx-viewer-shared';
import {
	appendElementOnSlide,
	findSlideElement,
	removeElement,
	strokeToInkElement,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';

/**
 * Ink stroke actions for the Draw ribbon tab: commit a freehand pen/
 * highlighter stroke as a new `InkPptxElement`, or erase an existing one.
 * Both mutations are history-integrated (push -> mutate -> commit), mirroring
 * `editor-background-actions.ts` and the `insertElement` helper in
 * `editor-edit-ops.ts`. The pointer-event lifecycle that accumulates a
 * stroke's points lives separately in `editor-draw-gestures.ts`; this module
 * only owns the resulting slide/history mutation.
 */
export interface InkActions {
	/**
	 * Build an `InkPptxElement` from a completed stroke (via the shared
	 * `strokeToInkElement`) and append it to the current slide, selected.
	 * A no-op when not editable, there is no current slide, or the stroke has
	 * fewer than 2 points (shared helper returns `null`, matching a plain tap).
	 */
	commitStroke(stroke: StrokeToInkElementOpts): void;
	/**
	 * Remove the ink/contentPart element with `id` from the current slide
	 * (Draw tab's eraser tool). `contentPart` is included because ink saved
	 * via the Draw tab reloads in that shape, so it must stay erasable after a
	 * save/reload round-trip. Returns `true` when a matching element was found
	 * and removed; `false` for a missing id, an unrelated element, or a
	 * read-only viewer (safe to call from a generic stage hit-test without a
	 * pre-check).
	 */
	eraseInkElement(id: string): boolean;
}

export interface InkActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
}

export function createInkActions(deps: InkActionsDeps): InkActions {
	const { store, ops } = deps;

	return {
		commitStroke(stroke) {
			const state = store.get();
			if (!state.editable || !state.slides[state.currentSlide]) {
				return;
			}
			const ink = strokeToInkElement(stroke);
			if (!ink) {
				return;
			}
			ops.pushHistory();
			store.set({
				slides: appendElementOnSlide(state.slides, state.currentSlide, ink),
				selectedElementId: ink.id,
			});
			ops.commitChange();
		},

		eraseInkElement(id) {
			const state = store.get();
			if (!state.editable) {
				return false;
			}
			const target = findSlideElement(state.slides, state.currentSlide, id);
			if (!target || (target.type !== 'ink' && target.type !== 'contentPart')) {
				return false;
			}
			ops.pushHistory();
			const selectedElementId = state.selectedElementId === id ? null : state.selectedElementId;
			store.set({
				slides: removeElement(state.slides, state.currentSlide, id),
				selectedElementId,
			});
			ops.commitChange();
			return true;
		},
	};
}
