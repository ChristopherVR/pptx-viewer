import {
	firstShowSlideIndex,
	resolveAuthoredSlideRange,
	resolveShowSlideIndexes,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';

/**
 * B7: `ppaction://customshow?id=<id>[&return=true]` (PowerPoint's "Custom
 * Show" hyperlink/action, with its "Resume last slide viewed after showing
 * this custom show" checkbox), the vanilla implementation of
 * `PresentationActionRunner.customShow`.
 *
 * Switching `activeCustomShowId` is a one-line store patch (`viewer-controls`
 * already resolves the show order off that field); the part worth its own
 * module is `returnAfter`: when the sub-show it just switched to runs off its
 * own end, the ordinary "end of show" path (`viewer-controls.next()` raising
 * `endOfShow`) must be intercepted and turned into "restore the previous show
 * and jump back to the origin slide" instead of ending the presentation. That
 * is watched here via a store subscription rather than threaded through
 * `viewer-controls.ts` itself, so the sub-show's own navigation
 * (hidden-slide skipping, looping, the black end screen for every OTHER
 * cause) is completely unmodified.
 *
 * @module viewer/presenter/presentation-custom-show-runner
 */

export interface CustomShowRunner {
	/** `PresentationActionRunner.customShow`. */
	customShow(customShowId: string, returnAfter: boolean): void;
	/** Detach the end-of-show watcher (chrome teardown). */
	dispose(): void;
}

export function createCustomShowRunner(
	store: Store<ViewerState>,
	goToSlide: (index: number) => void,
): CustomShowRunner {
	/** Where to land, and which show to restore, once the CURRENT sub-show ends. */
	let pendingReturn: { index: number; showId: string | null } | null = null;

	const unsubscribe = store.subscribe((state, previous) => {
		if (state.endOfShow && !previous.endOfShow && pendingReturn) {
			const origin = pendingReturn;
			pendingReturn = null;
			store.set({ activeCustomShowId: origin.showId, endOfShow: false });
			goToSlide(origin.index);
			return;
		}
		// Leaving the show (Escape, the audience closing it, etc.) makes a
		// pending return stale: its origin slide no longer describes where
		// re-entering the show should land.
		if (previous.presenting && !state.presenting) {
			pendingReturn = null;
		}
	});

	return {
		customShow(customShowId, returnAfter) {
			const state = store.get();
			const show = state.customShows.find((entry) => entry.id === customShowId);
			if (!show) {
				return;
			}
			if (returnAfter) {
				pendingReturn = { index: state.currentSlide, showId: state.activeCustomShowId };
			}
			const authoredRange = resolveAuthoredSlideRange(
				state.presentationProperties,
				state.slides.length,
			);
			const order = resolveShowSlideIndexes(state.slides, show, authoredRange);
			// `activeCustomShowId` first: `goToSlide` below re-renders through the
			// normal store-change pipeline, which must already see the new show.
			store.set({ activeCustomShowId: customShowId });
			const first = firstShowSlideIndex(order);
			if (first !== undefined) {
				goToSlide(first);
			}
		},
		dispose: unsubscribe,
	};
}
