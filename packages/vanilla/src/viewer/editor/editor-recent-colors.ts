import { mruColorsPatch, pushRecentColor, seedRecentColors } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';

/**
 * B6: `p:clrMru` ("Most Recently Used" colours), the deck-level list every
 * colour picker's "Recent colours" row should seed from and fold new picks
 * into.
 *
 * `mruColors` round-trips as `presentationProperties.mruColors` (core reads
 * and writes it there on load/save; vanilla's `editor-operations.ts` `save()`
 * already threads the whole `presentationProperties` object through), so
 * this reads/patches THAT field rather than adding a parallel top-level
 * store field that would need its own save wiring.
 *
 * @module viewer/editor/editor-recent-colors
 */

/** The deck's current recent-colours list, seeded and de-duplicated. */
export function currentRecentColors(state: ViewerState): string[] {
	return seedRecentColors({ mruColors: state.presentationProperties.mruColors });
}

/**
 * Fold a newly picked colour into the deck's MRU list and write it back
 * OUTSIDE the undo stack, exactly like the View tab's grid/snap/guide toggle
 * write-back (`editor-edit-ops.ts`'s `toggleViewOption`): which colours a
 * picker showed last is not something PowerPoint lets you undo.
 *
 * A no-op for anything that is not a plain 6-digit hex colour (a gradient, a
 * theme colour token, `transparent`, etc.), matching `pushRecentColor`'s own
 * contract.
 */
export function recordRecentColor(store: Store<ViewerState>, hex: string): void {
	const state = store.get();
	const current = currentRecentColors(state);
	const next = pushRecentColor(current, hex);
	if (next === current) {
		return;
	}
	store.set({
		presentationProperties: { ...state.presentationProperties, ...mruColorsPatch(next) },
	});
}
