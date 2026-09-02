import type { PptxSlide } from 'pptx-viewer-core';
import { firstShowSlideIndex, resolveShowSlideIndexes } from 'pptx-viewer-shared';
import { useRef } from 'react';

/**
 * useCustomShowRunner: the runtime side of `ppaction://customshow?id=<id>[&return=true]`.
 *
 * Switches the running show to a named custom show, and (when the action
 * carried PowerPoint's "Resume last slide viewed after showing this custom
 * show" flag) remembers where to come back to: the previously active show
 * and the slide the presenter was on. `tryReturnFromCustomShow` is the other
 * half - called wherever the show would otherwise end (advance past the sub
 * show's last slide); it restores the origin instead of ending, and reports
 * whether it did so.
 *
 * The actual decision logic ({@link createCustomShowRunner}) is a plain
 * factory with no React imports, so it is unit-tested directly; the hook is
 * only a stable-identity wrapper that always reads the latest props via a ref
 * (the same pattern `useKeyboardShortcuts` uses), so callers can hold onto
 * the returned runner across renders.
 *
 * @module presentation-mode/useCustomShowRunner
 */

export interface CustomShowDescriptor {
	id: string;
	slideRIds: string[];
}

export interface CustomShowRunnerDeps {
	getSlides: () => readonly PptxSlide[];
	getCustomShows: () => readonly CustomShowDescriptor[];
	getActiveCustomShowId: () => string | null;
	setActiveCustomShowId: (id: string | null) => void;
	/** Jump to a deck index; the same navigator every other action uses. */
	navigateToSlide: (slideIndex: number) => void;
	/** The presentation's CURRENT deck index, read fresh at call time. */
	getPresentationSlideIndex: () => number;
}

export interface CustomShowRunner {
	/** Run `ppaction://customshow?id=<id>[&return=true]`. */
	runCustomShow: (customShowId: string, returnAfter: boolean) => void;
	/**
	 * Called when the show is about to end (advance past the active show's
	 * last slide). Restores a pending "return after" origin instead, when one
	 * is armed.
	 * @returns `true` when a return was performed (the caller must not also
	 *   end the show); `false` when there was nothing to return to.
	 */
	tryReturnFromCustomShow: () => boolean;
}

/** Runtime origin recorded by a `returnAfter` custom-show jump. */
interface ReturnOrigin {
	showId: string | null;
	slideIndex: number;
}

/**
 * Plain, framework-free factory behind {@link useCustomShowRunner}. No React
 * imports, so a test drives it with hand-written spies instead of rendering.
 */
export function createCustomShowRunner(deps: CustomShowRunnerDeps): CustomShowRunner {
	let origin: ReturnOrigin | null = null;

	return {
		runCustomShow(customShowId, returnAfter) {
			const target = deps.getCustomShows().find((show) => show.id === customShowId);
			if (!target) {
				return;
			}
			origin = returnAfter
				? { showId: deps.getActiveCustomShowId(), slideIndex: deps.getPresentationSlideIndex() }
				: null;
			const first = firstShowSlideIndex(resolveShowSlideIndexes(deps.getSlides(), target));
			deps.setActiveCustomShowId(customShowId);
			if (first !== undefined) {
				deps.navigateToSlide(first);
			}
		},
		tryReturnFromCustomShow() {
			if (!origin) {
				return false;
			}
			const { showId, slideIndex } = origin;
			origin = null;
			deps.setActiveCustomShowId(showId);
			deps.navigateToSlide(slideIndex);
			return true;
		},
	};
}

export function useCustomShowRunner(deps: CustomShowRunnerDeps): CustomShowRunner {
	const depsRef = useRef(deps);
	depsRef.current = deps;
	const runnerRef = useRef<CustomShowRunner | null>(null);
	runnerRef.current ??= createCustomShowRunner({
		getSlides: () => depsRef.current.getSlides(),
		getCustomShows: () => depsRef.current.getCustomShows(),
		getActiveCustomShowId: () => depsRef.current.getActiveCustomShowId(),
		setActiveCustomShowId: (id) => depsRef.current.setActiveCustomShowId(id),
		navigateToSlide: (index) => depsRef.current.navigateToSlide(index),
		getPresentationSlideIndex: () => depsRef.current.getPresentationSlideIndex(),
	});
	return runnerRef.current;
}
