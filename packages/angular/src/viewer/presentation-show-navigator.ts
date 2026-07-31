/**
 * presentation-show-navigator.ts: the slide show's navigation state machine.
 *
 * "Which slide is up" is not a single number in PowerPoint's model: a forward
 * step may reveal the next animation build instead of changing slide, a
 * backward step may replay the current slide's builds instead of leaving it,
 * running off the end raises an end-of-show screen rather than wrapping, and an
 * authored `p:transition/@advTm` arms a timer that must be re-armed (and
 * cancelled) on every change. That is a state machine, and it was previously
 * interleaved with DOM wiring, keyboard handling and template plumbing inside
 * {@link PresentationOverlayComponent}.
 *
 * It lives here as a plain signal-holding class (no Angular injection context
 * needed) so the component keeps only the view wiring, and so the rules above
 * can be read in one place.
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
	 * File > Options > Advanced > "End with black slide". PowerPoint's default
	 * is ON: running past the last slide raises a black "End of slide show"
	 * screen and only the NEXT forward input ends the show. Turning it off ends
	 * the show immediately instead. Undefined means the PowerPoint default.
	 */
	endWithBlackSlide?: () => boolean | undefined;
}

export class PresentationShowNavigator {
	/** Zero-based index into `slides()`. */
	readonly currentIndex = signal(0);

	/**
	 * True once the show has run past its last slide and the black "End of slide
	 * show" screen is up. It MUST be surfaced: while it is up the next input
	 * either goes nowhere (backward) or ends the show (forward), so a deck that
	 * kept painting its last slide looked stuck and swallowed every advance.
	 */
	readonly endOfShow = signal(false);

	/** Active slide-transition animation, or null when none is playing. */
	readonly activeTransition = signal<ActiveSlideTransition | null>(null);

	/**
	 * Set just before a BACKWARD slide change so the host's slide effect seeds the
	 * incoming slide as fully built. Read-and-cleared via
	 * {@link takePendingCompletedEntry}.
	 */
	private pendingCompletedEntry = false;

	/** Pending `p:transition/@advTm` auto-advance timer for the current slide. */
	private autoAdvanceTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(private readonly deps: ShowNavigatorDeps) {}

	/**
	 * Consume the "entered backward" flag. The host's per-slide effect asks once
	 * per slide change, so this both reads and clears it.
	 */
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
		}
	}

	/**
	 * (Re)arm PowerPoint's "Advance slide: After <n>" timer, cancelling whatever
	 * was pending. Always cancelling first is load-bearing: a manual advance must
	 * never leave a stale timer running that then skips the slide the presenter
	 * just moved to.
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
		let next: number;

		switch (direction) {
			case 'next':
				next = nextVisibleIndex(current, slides);
				break;
			case 'prev':
				next = prevVisibleIndex(current, slides);
				break;
			case 'first':
				// Home goes to the START OF THE SHOW, which is not slide 1 when the
				// author hid it. Clamped anyway so an empty order cannot produce -1.
				next = clampIndex(firstVisibleIndex(slides), count);
				break;
			case 'last':
				next = clampIndex(lastVisibleIndex(slides), count);
				break;
		}

		if (direction === 'next' && !hasVisibleSlideAfter(current, slides)) {
			// Nothing further to advance to. `nextVisibleIndex` would wrap back to
			// the first slide and loop for ever; PowerPoint only loops when "Loop
			// continuously until Esc" is set, so end the show instead.
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
		// animating the outgoing slide out. Forward navigation only, matching
		// PowerPoint, which does not replay transitions when stepping back.
		const incoming = slides[next];
		const outgoing = slides[current];
		const transition =
			(direction === 'next' || direction === 'first') && incoming?.transition && outgoing
				? { outgoing, transition: incoming.transition }
				: null;
		this.commit(next, transition);
	}

	/**
	 * Jump directly to `index` (clamped to the slide range). Used by the
	 * zoom-navigation context for a click-to-jump from a zoom tile: this is a
	 * transition-less jump, so it does NOT replay the target slide's transition.
	 */
	goToSlide(index: number): void {
		const count = this.deps.slides().length;
		if (count === 0) {
			return;
		}
		const next = clampIndex(index, count);
		if (next === this.currentIndex()) {
			return;
		}
		this.commit(next, null);
	}

	/**
	 * The single place a slide change becomes visible: set the transition, move
	 * the index, retarget the annotation layer, and tell the host. Both entry
	 * points share it so a change to one can never silently skip a step in the
	 * other (they had drifted apart as four repeated statements before).
	 */
	private commit(next: number, transition: ActiveSlideTransition | null): void {
		this.activeTransition.set(transition);
		this.currentIndex.set(next);
		this.deps.annotations.setActiveSlide(next);
		this.deps.emitIndex(next);
	}
}
