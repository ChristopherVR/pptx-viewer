import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { isClickAdvanceAllowed } from 'pptx-viewer-shared';
import type { ElementAnimationState } from 'pptx-viewer-shared';

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
 * change, entrance elements hidden until revealed. Since the native-timing
 * migration it also drives staged chart / SmartArt builds (`p:bldChart` /
 * `p:bldDgm`), `p:animClr` colour animations, withPrevious / afterPrevious
 * auto-advance, and interactive / hover trigger sequences. Still no presenter
 * view (React-only).
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
	/** Host-provided action-sound player (resolves + plays embedded sounds). */
	onPlayActionSound?: (soundPath: string) => void;
	/** The live presentation stage root, to scope media-command lookups to. */
	getFrameRoot?(): HTMLElement | null;
	/** End the show (host leaves presentation mode). */
	exit?(): void;
	/** `p:showPr` "end with black slide"; defaults to on, like PowerPoint. */
	getEndWithBlackSlide?(): boolean | undefined;
}

export class PresentationController {
	readonly playback: AnimationPlayback;
	#transition = $state<TransitionState | null>(null);
	/**
	 * True once the show has run past its last slide and the black "End of slide
	 * show" screen is up. It MUST be surfaced: while it is up the next input
	 * either goes nowhere (backward) or ends the show (forward), so a deck that
	 * kept painting its last slide looked stuck and then exited with no warning.
	 */
	#endOfShow = $state(false);
	readonly #deps: PresentationControllerDeps;

	constructor(deps: PresentationControllerDeps) {
		this.#deps = deps;
		this.playback = new AnimationPlayback({
			getSlide: () => this.#currentSlide(),
			getShowWithAnimation: deps.getShowWithAnimation,
			onPlayActionSound: deps.onPlayActionSound,
			frameRoot: deps.getFrameRoot,
		});
	}

	#currentSlide(): PptxSlide | undefined {
		return this.#deps.getSlides()[this.#deps.getCurrentIndex()];
	}

	/** The active slide-transition overlay state, or `null` when none is playing. */
	/** Whether the black "End of slide show" screen should be rendered. */
	get endOfShowVisible(): boolean {
		return this.#endOfShow;
	}

	get transition(): TransitionState | null {
		return this.#transition;
	}

	/** Reactive per-element native-animation state (visibility, build, colour). */
	get elementStates(): Map<string, ElementAnimationState> {
		return this.playback.elementStates;
	}

	/** The per-slide native-animation `@keyframes` CSS to inject. */
	get keyframesCss(): string {
		return this.playback.keyframesCss;
	}

	/** Shape ids that trigger an interactive (`onShapeClick`) sequence. */
	get interactiveTriggerShapeIds(): ReadonlySet<string> {
		return this.playback.interactiveTriggerShapeIds;
	}

	/** Shape ids that trigger a hover (`onHover`) sequence. */
	get hoverTriggerShapeIds(): ReadonlySet<string> {
		return this.playback.hoverTriggerShapeIds;
	}

	/** Play an interactive shape's sequence; `true` when it triggered one. */
	handleInteractiveShapeClick(shapeId: string): boolean {
		return this.playback.handleInteractiveShapeClick(shapeId);
	}

	/** Play a hover shape's sequence; `true` when it triggered one. */
	handleHoverStart(shapeId: string): boolean {
		return this.playback.handleHoverStart(shapeId);
	}

	/** Reset a hover shape's sequence so the next hover replays it. */
	handleHoverEnd(shapeId: string): void {
		this.playback.handleHoverEnd(shapeId);
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
		// While the end screen is up, a forward input ends the show (PowerPoint's
		// "click to exit"); it never advances anything.
		if (this.#endOfShow) {
			this.#endOfShow = false;
			this.#deps.exit?.();
			return;
		}
		if (this.playback.advance()) {
			return;
		}
		if (fromClick && !isClickAdvanceAllowed(this.#currentSlide())) {
			return;
		}
		const next = this.#deps.getCurrentIndex() + 1;
		if (next >= this.#deps.getSlides().length) {
			if (this.#deps.getEndWithBlackSlide?.() === false) {
				// No black slide configured: end the show outright rather than
				// sitting on the last slide ignoring every further advance.
				this.#deps.exit?.();
			} else {
				this.#endOfShow = true;
			}
			return;
		}
		this.#deps.navigate(next);
	}

	/** Backward input while the end screen is up just dismisses it. */
	retreat(): boolean {
		if (!this.#endOfShow) {
			return false;
		}
		this.#endOfShow = false;
		return true;
	}

	/** Entering presentation: seed builds for the current slide, drop any overlay. */
	start(): void {
		ensurePresentationKeyframes();
		this.playback.reset();
		this.#transition = null;
		this.#endOfShow = false;
	}

	/** Leaving presentation: clear timers, reset builds, drop any overlay. */
	stop(): void {
		this.playback.clearTimers();
		this.playback.reset();
		this.#transition = null;
		this.#endOfShow = false;
	}

	/**
	 * The presented slide changed: reset the new slide's builds and, when the
	 * incoming slide carries a real transition, play it over the frame.
	 */
	onSlideChange(previousIndex: number, nextIndex: number): void {
		this.#endOfShow = false;
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
