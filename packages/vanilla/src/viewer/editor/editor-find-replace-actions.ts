import type { PptxSlide } from 'pptx-viewer-core';
import { findInSlides, replaceInSlides, replaceMatch } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';

/**
 * Find & Replace actions for the ribbon's Home > Editing group, backed by the
 * shared `find-replace.ts` helpers. A lean, docked-panel implementation:
 * `search` reports a match count for the query, `replaceCurrent` replaces the
 * first match, and `replaceAll` replaces every match; there is no in-canvas
 * match highlighting or "next/previous match" cursor (that needs per-match
 * selection/scroll wiring into the renderer, out of scope for this wave).
 * Every replace is history-integrated like every other editor action.
 */
export interface FindReplaceActions {
	/** Count occurrences of `query` across all slides (does not mutate). */
	search(query: string, matchCase: boolean): number;
	/** Replace the first match of `query`; returns the number replaced (0 or 1). */
	replaceCurrent(query: string, replacement: string, matchCase: boolean): number;
	/** Replace every match of `query`; returns the number replaced. */
	replaceAll(query: string, replacement: string, matchCase: boolean): number;
}

export interface FindReplaceActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
}

export function createFindReplaceActions(deps: FindReplaceActionsDeps): FindReplaceActions {
	const { store, ops } = deps;

	const commitReplace = (slides: readonly PptxSlide[], replacements: number): void => {
		if (replacements === 0) {
			return;
		}
		ops.pushHistory();
		store.set({ slides: [...slides] });
		ops.commitChange();
	};

	return {
		search(query, matchCase) {
			if (!query) {
				return 0;
			}
			return findInSlides(store.get().slides, query, { matchCase }).length;
		},

		replaceCurrent(query, replacement, matchCase) {
			const state = store.get();
			if (!state.editable || !query) {
				return 0;
			}
			const results = findInSlides(state.slides, query, { matchCase });
			const { slides, replacements } = replaceMatch(state.slides, results, 0, replacement);
			commitReplace(slides, replacements);
			return replacements;
		},

		replaceAll(query, replacement, matchCase) {
			const state = store.get();
			if (!state.editable || !query) {
				return 0;
			}
			const { slides, replacements } = replaceInSlides(state.slides, query, replacement, {
				matchCase,
			});
			commitReplace(slides, replacements);
			return replacements;
		},
	};
}
