/**
 * presentation-show-navigator.ts: the slide show's navigation state machine.
 *
 * "Which slide is up" is not a single number in PowerPoint's model: a forward
 * step may reveal the next animation build instead of changing slide, a
 * backward step may replay the current slide's builds instead of leaving it,
 * running off the end raises an end-of-show screen rather than wrapping, and an
 * authored `p:transition/@advTm` arms a timer re-armed (and cancelled) on every
 * change. It lives here as a plain signal-holding class (no Angular injection
 * context needed) so {@link PresentationOverlayComponent} keeps only view
 * wiring, and the rules above stay in one place.
 */
import { signal } from '@angular/core';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';

import type { AnimationPlaybackService } from './animation-playback.service';
import type { PresentationAnnotationsService } from './presentation-annotations.service';
import {
	clampIndex,
	firstVisibleIndex,
	hasVisibleSlideAfter,
	lastVisibleIndex,
	nextVisibleIndex,
	prevVisibleIndex,
} from './presentation-overlay-helpers';
import type { ActiveShow, AuthoredRange } from './presentation-overlay-helpers';

/** Where a navigation request wants to go. */
export type ShowDirection = 'next' | 'prev' | 'first' | 'last';

/**
 * The outgoing slide plus the incoming slide's transition, played over the new
 * slide. Cleared once the transition overlay reports completion.
 */
export interface ActiveSlideTransition {
	outgoing: PptxSlide;
	transition: PptxSlideTransition;
}

/** Everything the navigator needs from its host component. */
export interface ShowNavigatorDeps {
	slides: () => readonly PptxSlide[];
	/**
	 * The running custom show, when one is active. `slides()` is always the whole
	 * deck: the subset is a navigation rule, not a different slide array, so that
	 * a hidden slide inside the show is still skipped and the editor's index
	 * space never has to be translated.
	 */
	activeCustomShow?: () => ActiveShow;
	/**
	 * The `p:showPr/p:sldRg` range, when the deck opens into a range rather than
	 * the whole deck or a custom show. Applied like `activeCustomShow`: a filter
	 * on the navigable order, not a pre-filtered slide array.
	 */
	authoredRange?: () => AuthoredRange;
	/** The slide at the CURRENT index (a computed over `currentIndex`). */
	currentSlide: () => PptxSlide | undefined;
	showWithAnimation: () => boolean | undefined;
	playback: AnimationPlaybackService;
	annotations: PresentationAnnotationsService;
	/** Publish a committed index change to the host's `indexChange` output. */
	emitIndex: (index: number) => void;
	/** Ask the host to end the show; the host guards against double-closing. */
	requestClose: () => void;
	/**
	 * File > Options > Advanced > "End with black slide". PowerPoint's default is
	 * ON: running past the last slide raises a black end screen and only the NEXT
	 * forward input ends the show; off ends the show immediately instead.
	 */
	endWithBlackSlide?: () => boolean | undefined;
	/**
	 * Set Up Slide Show > "Loop continuously until 'Esc'": wraps to the show's
	 * first slide instead of raising the end screen (or exiting).
	 */
	loopContinuously?: () => boolean | undefined;
}

export class PresentationShowNavigator {
	/** Zero-based index into `slides()`. */
	readonly currentIndex = signal(0);

	/**
	 * True once the show has run past its last slide and the black end screen is
	 * up: while it is up the next input either goes nowhere (backward) or ends
	 * the show (forward), so a stuck deck must surface this rather than swallow
	 * every advance.
	 */
	readonly endOfShow = signal(false);

	/** Active slide-transition animation, or null when none is playing. */
	readonly activeTransition = signal<ActiveSlideTransition | null>(null);

	/**
	 * Set just before a BACKWARD change so the host's slide effect seeds the
	 * incoming slide as fully built. Read-and-cleared via
	 * {@link takePendingCompletedEntry}.
	 */
	private pendingCompletedEntry = false;

	/** Pending `p:transition/@advTm` auto-advance timer for the current slide. */
	private autoAdvanceTimer: ReturnType<typeof setTimeout> | undefined;

	/** Deck index before each committed change; backs {@link goToLastViewed}. */
	private previousIndex: number | null = null;

	constructor(private readonly deps: ShowNavigatorDeps) {}

	/** Consume the "entered backward" flag: reads and clears it in one call. */
	takePendingCompletedEntry(): boolean {
		const completed = this.pendingCompletedEntry;
		this.pendingCompletedEntry = false;
		return completed;
	}

	/**
	 * Adopt an index pushed in by the host (its `startIndex` input, which an
	 * audience display drives from the presenter's snapshot). Silent: it does not
	 * echo back through `emitIndex`, which would fight the host for control.
	 */
	syncFromHost(requestedIndex: number): void {
		const count = this.deps.slides().length;
		if (count === 0) {
			return;
		}
		const requested = clampIndex(requestedIndex, count);
		if (requested !== this.currentIndex()) {
			this.currentIndex.set(requested);
			this.deps.annotations.setActiveSlide(requested);
			// A host-forced jump (customShow return-after restoring the origin
			// slide) supersedes the black end screen: the host would not push a
			// new slide if it considered the show over.
			this.endOfShow.set(false);
		}
	}

	/**
	 * Jump back to the slide the show was on immediately before the current one
	 * (`ppaction://hlinkshowjump?jump=lastslideviewed`). A no-op before any
	 * navigation has happened yet.
	 */
	goToLastViewed(): void {
		if (this.previousIndex !== null) {
			this.goToSlide(this.previousIndex);
		}
	}

	/**
	 * (Re)arm PowerPoint's "Advance slide: After <n>" timer, always cancelling
	 * whatever was pending first: a manual advance must never leave a stale
	 * timer running that skips the slide the presenter just moved to.
	 */
	armAutoAdvance(delayMs: number | undefined): void {
		this.clearAutoAdvance();
		if (delayMs === undefined) {
			return;
		}
		this.autoAdvanceTimer = setTimeout(() => {
			this.autoAdvanceTimer = undefined;
			this.navigate('next');
		}, delayMs);
	}

	/** Cancel any pending timed auto-advance (also called on teardown). */
	clearAutoAdvance(): void {
		if (this.autoAdvanceTimer !== undefined) {
			clearTimeout(this.autoAdvanceTimer);
			this.autoAdvanceTimer = undefined;
		}
	}

	navigate(direction: ShowDirection): void {
		const slides = this.deps.slides();
		const count = slides.length;
		if (count === 0) {
			return;
		}

		// While the end screen is up a forward input ends the show (PowerPoint's
		// "click to exit") and a backward input just dismisses it.
		if (this.endOfShow()) {
			this.endOfShow.set(false);
			if (direction === 'next') {
				this.deps.requestClose();
			}
			return;
		}

		// On forward navigation, first reveal the next click-group of element
		// animations; only advance the slide once the slide's builds are exhausted.
		if (direction === 'next' && this.deps.playback.advance()) {
			return;
		}

		if (direction === 'prev') {
			// A slide entered backward shows its builds already complete. The next
			// back press replays them from the start rather than leaving the slide,
			// so a presenter who overshot can watch the build again (PowerPoint).
			if (this.deps.playback.isSeededCompleted()) {
				this.deps.playback.setSlide(this.deps.currentSlide(), this.deps.showWithAnimation());
				return;
			}
			// PowerPoint shows a slide you step BACK onto with its builds played.
			this.pendingCompletedEntry = true;
		}

		const current = this.currentIndex();
		const activeShow = this.deps.activeCustomShow?.();
		const authoredRange = this.deps.authoredRange?.();
		let next: number;

		switch (direction) {
			case 'next':
				next = nextVisibleIndex(current, slides, activeShow, authoredRange);
				break;
			case 'prev':
				next = prevVisibleIndex(current, slides, activeShow, authoredRange);
				break;
			case 'first':
				// Home goes to the START OF THE SHOW, which is not slide 1 when the
				// author hid it. Clamped anyway so an empty order cannot produce -1.
				next = clampIndex(firstVisibleIndex(slides, activeShow, authoredRange), count);
				break;
			case 'last':
				next = clampIndex(lastVisibleIndex(slides, activeShow, authoredRange), count);
				break;
		}

		// `nextVisibleIndex` always wraps back to the first slide (`loop: true`)
		// so `next` above is already the wrapped index; whether that wrap is
		// honoured or overridden into ending the show is "Loop continuously
		// until Esc" (Set Up Slide Show), matching PowerPoint's own default OFF.
		if (
			direction === 'next' &&
			!hasVisibleSlideAfter(current, slides, activeShow, authoredRange) &&
			this.deps.loopContinuously?.() !== true
		) {
			if (this.deps.endWithBlackSlide?.() === false) {
				// No black slide configured: PowerPoint ends the show outright rather
				// than sitting on the last slide ignoring every further advance.
				this.deps.requestClose();
				return;
			}
			this.endOfShow.set(true);
			return;
		}

		if (next === current) {
			return;
		}

		// Play the incoming slide's transition (if any) over the new slide,
		// animating the outgoing slide out. A backward step replays the LEAVING
		// slide's transition in reverse instead (PowerPoint: a morph glides its
		// shapes back to where they came from).
		const incoming = slides[next];
		const outgoing = slides[current];
		const transition =
			direction === 'prev'
				? outgoing?.transition && incoming
					? { outgoing, transition: outgoing.transition }
					: null
				: (direction === 'next' || direction === 'first') && incoming?.transition && outgoing
					? { outgoing, transition: incoming.transition }
					: null;
		this.commit(next, transition);
	}

	/**
	 * Jump directly to `index` (clamped). Used by zoom tiles and by on-slide
	 * Action Settings (`ppaction://hlinksldjump`); ENTERS the target slide, so
	 * PowerPoint plays its transition exactly as a forward step does.
	 */
	goToSlide(index: number): void {
		const slides = this.deps.slides();
		const count = slides.length;
		if (count === 0) {
			return;
		}
		const next = clampIndex(index, count);
		const current = this.currentIndex();
		if (next === current) {
			return;
		}
		const incoming = slides[next];
		const outgoing = slides[current];
		this.commit(
			next,
			incoming?.transition && outgoing ? { outgoing, transition: incoming.transition } : null,
		);
	}

	/**
	 * The single place a slide change becomes visible: set the transition, move
	 * the index, retarget the annotation layer, and tell the host.
	 */
	private commit(next: number, transition: ActiveSlideTransition | null): void {
		this.previousIndex = this.currentIndex();
		this.activeTransition.set(transition);
		this.currentIndex.set(next);
		this.deps.annotations.setActiveSlide(next);
		this.deps.emitIndex(next);
	}
}
