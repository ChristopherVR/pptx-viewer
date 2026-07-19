import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { isClickAdvanceAllowed } from 'pptx-viewer-shared';
import type { CSSProperties } from 'pptx-viewer-shared';

import { AnimationPlayback } from './animation-playback.svelte';
import { ensurePresentationKeyframes } from './keyframes';

/**
 * `PresentationController`: the runes state machine wiring the Svelte viewer's
 * fullscreen (presentation) mode to the framework-agnostic animation and
 * slide-transition helpers in `pptx-viewer-shared`.
 *
 * It owns:
 *  - an {@link AnimationPlayback} for the current slide's click-stepped element
 *    builds, and
 *  - the transient slide-transition state (outgoing + incoming slide + the
 *    resolved transition) rendered by `PresentationTransitionOverlay`.
 *
 * `advance()` implements the on-click contract: reveal the next animation build
 * first, and only advance the slide once the slide's builds are exhausted.
 * `onSlideChange` / `start` / `stop` are driven from a `$effect` in the viewer
 * (see `usePresentationEffects`) as the fullscreen flag and current slide move.
 *
 * Matches the Vue binding's presentation-mode behaviour (its parity bar):
 * click-stepped element animations, CSS-driven slide transitions on every slide
 * change, entrance elements hidden until revealed. Deliberately narrower than
 * React's presentation mode: no auto-advance/`afterPrevious` timers, no
 * interactive/hover trigger sequences, no presenter view (all React-only).
 */
export interface TransitionState {
	/** The outgoing (previous) slide, rendered in the exit layer. */
	outgoing: PptxSlide | undefined;
	/** The incoming (new) slide, rendered in the entrance layer. */
	incoming: PptxSlide | undefined;
	/** The incoming slide's transition (drives the CSS animation shorthands). */
	transition: PptxSlideTransition;
}

export interface PresentationControllerDeps {
	/** The live, editable slide array (single source of truth). */
	getSlides(): PptxSlide[];
	/** The active slide index (0-based). */
	getCurrentIndex(): number;
	/** Navigate to a slide index (clamped by the caller's viewer state). */
	navigate(index: number): void;
	/** Presentation-level switch parsed from `p:showPr`. */
	getShowWithAnimation?(): boolean | undefined;
}

export class PresentationController {
	readonly playback: AnimationPlayback;
	#transition = $state<TransitionState | null>(null);
	readonly #deps: PresentationControllerDeps;

	constructor(deps: PresentationControllerDeps) {
		this.#deps = deps;
		this.playback = new AnimationPlayback({
			getAnimations: () => this.#currentSlide()?.animations ?? [],
			getShowWithAnimation: deps.getShowWithAnimation,
		});
	}

	#currentSlide(): PptxSlide | undefined {
		return this.#deps.getSlides()[this.#deps.getCurrentIndex()];
	}

	/** The active slide-transition overlay state, or `null` when none is playing. */
	get transition(): TransitionState | null {
		return this.#transition;
	}

	/** Revealed element build styles for the current slide/step. */
	get elementStyles(): Map<string, CSSProperties> {
		return this.playback.elementStyles;
	}

	/** Pending (hidden-until-revealed) entrance styles for the current slide/step. */
	get pendingStyles(): Map<string, CSSProperties> {
		return this.playback.pendingStyles;
	}

	/**
	 * The on-click advance contract: reveal the next element-animation build if
	 * one remains, otherwise advance to the next slide.
	 *
	 * `fromClick` marks a click/tap/swipe on the slide, which is PowerPoint's
	 * "on mouse click" advance: it still steps the remaining animation builds,
	 * but once they are exhausted it advances the slide only when the current
	 * slide's transition allows it (advanceOnClick !== false). Keyboard and the
	 * on-screen next button pass `fromClick = false` and are never gated.
	 */
	advance(fromClick = false): void {
		if (this.playback.advance()) {
			return;
		}
		if (fromClick && !isClickAdvanceAllowed(this.#currentSlide())) {
			return;
		}
		this.#deps.navigate(this.#deps.getCurrentIndex() + 1);
	}

	/** Entering presentation: seed builds for the current slide, drop any overlay. */
	start(): void {
		ensurePresentationKeyframes();
		this.playback.reset();
		this.#transition = null;
	}

	/** Leaving presentation: reset builds and drop any transition overlay. */
	stop(): void {
		this.playback.reset();
		this.#transition = null;
	}

	/**
	 * The presented slide changed: reset the new slide's builds and, when the
	 * incoming slide carries a real transition, play it over the frame.
	 */
	onSlideChange(previousIndex: number, nextIndex: number): void {
		this.playback.reset();
		const slides = this.#deps.getSlides();
		const incoming = slides[nextIndex];
		const transition = incoming?.transition;
		if (transition && transition.type && transition.type !== 'none') {
			this.#transition = { outgoing: slides[previousIndex], incoming, transition };
		} else {
			this.#transition = null;
		}
	}

	/** The transition overlay finished its animation: drop it. */
	endTransition(): void {
		this.#transition = null;
	}
}
