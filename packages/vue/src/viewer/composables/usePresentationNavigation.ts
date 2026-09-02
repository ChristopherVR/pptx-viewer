/**
 * usePresentationNavigation: where a slideshow advance actually lands.
 *
 * One composable rather than several because "next" is a three-level decision
 * that only reads correctly in one place: step the current slide's remaining
 * animation builds; if none are left, move to the next slide the SHOW visits
 * (hidden slides skipped, custom show honoured); if there is none, show the
 * black end screen or end the show outright. The slide-transition overlay is
 * driven by the same index change, so it lives here too.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { acceptsPresentationInput, isClickAdvanceAllowed } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import type { UseAnimationPlaybackResult } from './useAnimationPlayback';
import type { PresentationShowOrder } from './usePresentationShowOrder';

/** The active slide's transition, plus the two slides it animates between. */
export interface PresentationTransitionState {
	outgoing: PptxSlide | undefined;
	incoming: PptxSlide | undefined;
	transition: NonNullable<PptxSlide['transition']>;
}

export interface UsePresentationNavigationOptions {
	slides: () => PptxSlide[];
	startIndex: () => number;
	/**
	 * A GETTER, not the value: the playback controller is built FROM
	 * `activeSlide`, which this composable owns, so the two would otherwise be a
	 * construction cycle. Every read here happens at user-input time, long after
	 * both exist.
	 */
	playback: () => UseAnimationPlaybackResult;
	showOrder: PresentationShowOrder;
	/** File > Options > Advanced: show a black slide instead of ending outright. */
	endWithBlackSlide: () => boolean;
	/**
	 * Slide Show Setup > "Loop continuously until 'Esc'" (or a kiosk-type show,
	 * which forces it): advancing past the show's last slide wraps to its first
	 * slide instead of raising the end screen or exiting. Callers should pass
	 * shared's `shouldLoopContinuously(presentationProperties)`.
	 */
	loopContinuously?: () => boolean;
	/** Leave the show (goes through the keep-annotations prompt when needed). */
	requestClose: () => void;
	onSlideChange: (index: number) => void;
	/**
	 * Checked before the loop / black-slide / close fallback, when the running
	 * show has no next slide. Returning `true` means the caller already
	 * navigated (e.g. a `ppaction://customshow?...&return=true` sub-show
	 * restoring the origin show and slide) and `next()` should do nothing
	 * further. Returning `false` (or omitting the option) falls through to the
	 * normal end-of-show handling.
	 */
	onShowEnd?: () => boolean;
}

export interface UsePresentationNavigationResult {
	currentIndex: Ref<number>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	/** Black "End of slide show" screen shown past the last slide (option-gated). */
	showEndScreen: Ref<boolean>;
	/**
	 * Jump straight to a deck index. Deliberately NOT filtered by the show order:
	 * PowerPoint's typed "slide number + Enter" reaches a hidden slide on purpose,
	 * and slide-zoom tiles link to whatever slide they name.
	 */
	goTo: (index: number) => void;
	next: () => void;
	prev: () => void;
	/**
	 * Click/tap/swipe advance. Like `next()` it first steps the current slide's
	 * remaining animation builds, but once they are exhausted it advances the
	 * slide only when the slide's transition allows click-advance
	 * (`advanceOnClick !== false`), matching PowerPoint's "on mouse click" gate.
	 * Keyboard, the toolbar next button and the end screen keep calling `next()`.
	 */
	advanceFromClick: () => void;
	/** Non-null while a slide transition is playing over the frame. */
	transitionState: Ref<PresentationTransitionState | null>;
	onTransitionDone: () => void;
}

export function usePresentationNavigation(
	options: UsePresentationNavigationOptions,
): UsePresentationNavigationResult {
	const { showOrder } = options;
	const playback = (): UseAnimationPlaybackResult => options.playback();

	function clampIndex(index: number): number {
		const last = Math.max(0, options.slides().length - 1);
		if (index < 0) {
			return 0;
		}
		return index > last ? last : index;
	}

	const currentIndex = ref(clampIndex(options.startIndex()));
	const activeSlide = computed<PptxSlide | undefined>(() => options.slides()[currentIndex.value]);
	const showEndScreen = ref(false);
	const transitionState = ref<PresentationTransitionState | null>(null);

	function goTo(index: number): void {
		const target = clampIndex(index);
		if (target === currentIndex.value) {
			return;
		}
		currentIndex.value = target;
	}

	function next(): void {
		if (showEndScreen.value) {
			// A second advance on the end screen exits the show, like PowerPoint.
			options.requestClose();
			return;
		}
		if (playback().advance()) {
			return; // revealed an animation build step; stay on the slide
		}
		if (!showOrder.hasNext(currentIndex.value)) {
			// A returning sub-show (`ppaction://customshow?...&return=true`)
			// outranks everything else: PowerPoint resumes the show it branched
			// from at the slide it branched at, not the black end screen.
			if (options.onShowEnd?.()) {
				return;
			}
			// "Loop continuously until 'Esc'" outranks both the black end screen and
			// exiting: PowerPoint wraps straight back to the show's first slide.
			if (options.loopContinuously?.()) {
				goTo(showOrder.first(currentIndex.value));
				return;
			}
			if (options.endWithBlackSlide()) {
				showEndScreen.value = true;
			} else {
				// No black slide configured: PowerPoint ends the show outright rather
				// than sitting on the last slide ignoring every further advance.
				options.requestClose();
			}
			return;
		}
		goTo(showOrder.next(currentIndex.value));
	}

	function prev(): void {
		if (showEndScreen.value) {
			showEndScreen.value = false;
			return;
		}
		// A slide entered backward shows its builds already complete. The next back
		// press replays them from the start rather than leaving the slide, so a
		// presenter who overshot can watch the build again (PowerPoint).
		if (playback().seededCompleted.value) {
			playback().reset();
			return;
		}
		// PowerPoint shows a slide you step BACK onto with its builds already played.
		playback().markNextEntryCompleted();
		goTo(showOrder.previous(currentIndex.value));
	}

	function advanceFromClick(): void {
		// An audience display never drives itself: a tap or swipe of its own would
		// move it off the presenter's slide, and the next snapshot would drag it back.
		if (!acceptsPresentationInput()) {
			return;
		}
		if (
			!showEndScreen.value &&
			playback().isComplete.value &&
			!isClickAdvanceAllowed(activeSlide.value)
		) {
			return;
		}
		next();
	}

	watch(currentIndex, (index, previousIndex) => {
		options.onSlideChange(index);
		// The playback controller rebuilds itself on the active-slide change (it
		// watches `activeSlide`), so no explicit reset is needed here.
		const incoming = options.slides()[index];
		// Forward steps play the ENTERING slide's transition; a backward step
		// replays the LEAVING slide's transition in reverse (a morph glides its
		// shapes back to where they came from).
		const transition = (index < previousIndex ? options.slides()[previousIndex] : incoming)
			?.transition;
		transitionState.value =
			transition && transition.type && transition.type !== 'none'
				? { outgoing: options.slides()[previousIndex], incoming, transition }
				: null;
	});

	return {
		currentIndex,
		activeSlide,
		showEndScreen,
		goTo,
		next,
		prev,
		advanceFromClick,
		transitionState,
		onTransitionDone: () => {
			transitionState.value = null;
		},
	};
}
