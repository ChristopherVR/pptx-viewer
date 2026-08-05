/**
 * Presentation visibility + cross-slide audio lifecycle for the vanilla show.
 *
 * While the show runs, a hidden tab is a paused show: the shared
 * `attachPresentationVisibilityPause` pauses the stage's playing media and the
 * cross-slide persistent audio, and this wiring also cancels the pending
 * auto-advance so the deck does not run on unseen; everything resumes (and the
 * current slide's timing re-arms from scratch) when the tab is visible again.
 *
 * When `presenting` flips false the show has EXITED (slide changes never touch
 * the flag), so all cross-slide "play across slides" persistent audio stops:
 * a track that spans slides still ends with the show, never after it.
 */
import { attachPresentationVisibilityPause, stopAllPersistentAudio } from 'pptx-viewer-shared';

export interface ShowVisibilityDeps {
	/** Read the live `presenting` flag. */
	getPresenting: () => boolean;
	/** Subscribe to viewer-state changes; returns an unsubscribe function. */
	subscribe: (listener: () => void) => () => void;
	/** The chrome root containing the stage; only media inside it is paused. */
	root?: ParentNode;
	/** Cancel the pending auto-advance timer (the tab was hidden). */
	cancelAutoAdvance: () => void;
	/** Re-arm the auto-advance timer for the current slide (tab visible again). */
	rearmAutoAdvance: () => void;
}

/**
 * Track `presenting` transitions on the store: attach the shared visibility
 * pause when a show starts, detach it and stop all persistent audio when the
 * show ends. Returns a detach function for chrome teardown, which also stops
 * persistent audio if the viewer is torn down mid-show.
 */
export function attachShowVisibilityPause(deps: ShowVisibilityDeps): () => void {
	let detachPause: (() => void) | undefined;
	let wasPresenting = false;

	const sync = (): void => {
		const presenting = deps.getPresenting();
		if (presenting === wasPresenting) {
			return;
		}
		wasPresenting = presenting;
		if (presenting) {
			detachPause = attachPresentationVisibilityPause({
				root: deps.root,
				onHidden: deps.cancelAutoAdvance,
				onVisible: deps.rearmAutoAdvance,
			});
			return;
		}
		detachPause?.();
		detachPause = undefined;
		stopAllPersistentAudio();
	};

	const detachStore = deps.subscribe(sync);
	sync();

	return () => {
		detachStore();
		detachPause?.();
		detachPause = undefined;
		if (wasPresenting) {
			wasPresenting = false;
			stopAllPersistentAudio();
		}
	};
}
