import type { PptxCustomShow, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import {
	applyHighlightClickStyle,
	findHighlightClickTarget,
	firstShowSlideIndex,
	handlePresentationStageClick,
	hasShowSlideAfter,
	HIGHLIGHT_CLEAR_STYLE,
	isClickAdvanceAllowed,
	lastShowSlideIndex,
	nextShowSlideIndex,
	presentationEntrySlideIndex,
	previousShowSlideIndex,
	resolveShowSlideIndexes,
	stopAllPersistentAudio,
} from 'pptx-viewer-shared';
import type { AuthoredSlideRange, ElementAnimationState } from 'pptx-viewer-shared';

import type { CustomShowReturnState } from './action-runner-callbacks';
import { buildWaveFourActionCallbacks } from './action-runner-callbacks';
import { AnimationPlayback } from './animation-playback.svelte';
import { stopAnimationSound } from './animation-sound';
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
	/**
	 * The slide canvas size (px), for a `p:anim` formula needing the animated
	 * shape's real box (e.g. Grow And Turn's `-#ppt_w/2` fly-in).
	 */
	getCanvasSize?(): { width: number; height: number } | undefined;
	/** The deck's resolved theme colour map, for a scheme-colour (`a:schemeClr`) animation stop. */
	getThemeColorMap?(): Readonly<Record<string, string>> | undefined;
	/** End the show (host leaves presentation mode). */
	exit?(): void;
	/** `p:showPr` "end with black slide"; defaults to on, like PowerPoint. */
	getEndWithBlackSlide?(): boolean | undefined;
	/**
	 * Slide Show > Set Up Show > "Loop continuously until 'Esc'"
	 * (`p:presentationPr/@loopContinuously`), or the implicit loop of a kiosk
	 * (`showType === 'kiosk'`) show. When true, advancing past the last slide
	 * wraps to the show's first slide instead of raising the black end screen
	 * or exiting.
	 */
	getLoopContinuously?(): boolean | undefined;
	/**
	 * Membership of the custom show the user selected, or null/undefined for the
	 * whole deck. Restricts and reorders the show; hiding still wins over it.
	 */
	getActiveCustomShow?(): { slideRIds: string[] } | null | undefined;
	/**
	 * Trust Center gate for an on-slide Action Setting that opens an external
	 * URL (Options > Trust Center > "Confirm before opening external
	 * hyperlinks"). Forwarded to `PresentationActionRunner.confirmUrl`;
	 * omitted opens unconditionally.
	 */
	confirmUrl?(url: string): boolean;
	/**
	 * The `p:showPr/p:sldRg` authored slide-range restriction (deck opens into
	 * slides `fromIndex..toIndex` rather than the whole deck), when no custom
	 * show is active. `resolveShowSlideIndexes` applies hiding and the active
	 * custom show first, same as `getActiveCustomShow`; this is the third,
	 * lowest-precedence restriction.
	 */
	getAuthoredRange?(): AuthoredSlideRange | null | undefined;
	/**
	 * The deck's custom shows, for `ppaction://customshow?id=<id>` (wave-4
	 * B7): the runner resolves `id` against this list to find the show's
	 * membership.
	 */
	getCustomShows?(): readonly PptxCustomShow[];
	/** Current active custom show id (or null for the whole deck), read back by `returnAfter`. */
	getActiveCustomShowId?(): string | null;
	/** Switch the active custom show (mirrors {@link getActiveCustomShow}'s source of truth). */
	setActiveCustomShowId?(id: string | null): void;
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
	/**
	 * Set while a `ppaction://customshow?...&return=true` sub-show is running
	 * (wave-4 B7): when that show runs off its end, {@link advance} restores
	 * the previous active show and returns to the origin slide instead of
	 * raising the end screen.
	 */
	#customShowReturn: CustomShowReturnState | null = null;
	/** Last-viewed slide, for `ppaction://hlinkshowjump?jump=lastslideviewed` (wave-4 B7). */
	#lastViewedIndex: number | undefined;
	readonly #deps: PresentationControllerDeps;

	constructor(deps: PresentationControllerDeps) {
		this.#deps = deps;
		this.playback = new AnimationPlayback({
			getSlide: () => this.#currentSlide(),
			getShowWithAnimation: deps.getShowWithAnimation,
			onPlayActionSound: deps.onPlayActionSound,
			frameRoot: deps.getFrameRoot,
			getCanvasSize: deps.getCanvasSize,
			getThemeColorMap: deps.getThemeColorMap,
		});
	}

	#currentSlide(): PptxSlide | undefined {
		return this.#deps.getSlides()[this.#deps.getCurrentIndex()];
	}

	/** The element currently flashed by `a:hlinkHover/@highlightClick`, if any. */
	#highlightedHoverElement: HTMLElement | null = null;

	/**
	 * `@highlightClick` ("Highlight click"): a brief flash independent of
	 * whatever the action itself does, so it runs even for a no-op action.
	 */
	#applyClickHighlight(target: unknown): void {
		const found = findHighlightClickTarget(target, this.#currentSlide());
		if (!found?.descriptor.click) {
			return;
		}
		const { element } = found;
		const { style, clearStyle, durationMs } = found.descriptor.click;
		applyHighlightClickStyle(element, style);
		setTimeout(() => {
			applyHighlightClickStyle(element, clearStyle);
		}, durationMs);
	}

	/**
	 * `a:hlinkHover/@highlightClick`: the same flash as the click version, held
	 * for the duration of the hover rather than timed. Called from
	 * `attachPresentationTriggerListeners`'s `mouseover`, alongside (but
	 * independent of) the native-animation hover trigger it already drives.
	 */
	applyHoverHighlight(target: unknown): void {
		const found = findHighlightClickTarget(target, this.#currentSlide());
		const nextElement = found?.descriptor.hover ? found.element : null;
		if (nextElement === this.#highlightedHoverElement) {
			return;
		}
		if (this.#highlightedHoverElement) {
			applyHighlightClickStyle(this.#highlightedHoverElement, HIGHLIGHT_CLEAR_STYLE);
		}
		this.#highlightedHoverElement = nextElement;
		if (nextElement && found?.descriptor.hover) {
			applyHighlightClickStyle(nextElement, found.descriptor.hover.enterStyle);
		}
	}

	/** Clear whatever `applyHoverHighlight` last set, on leaving the stage. */
	clearHoverHighlight(): void {
		if (this.#highlightedHoverElement) {
			applyHighlightClickStyle(this.#highlightedHoverElement, HIGHLIGHT_CLEAR_STYLE);
			this.#highlightedHoverElement = null;
		}
	}

	/**
	 * The deck indexes this show visits: the selected custom show's membership
	 * (or the whole deck), minus every slide the author hid.
	 *
	 * PowerPoint's "Hide Slide" keeps the slide in the deck, the thumbnail rail
	 * and the sorter but skips it while presenting, so only the show's own
	 * next / previous / Home / End consult this. A direct jump (`viewer.goTo`,
	 * used by the typed "slide number + Enter") deliberately does not. The same
	 * shared rule resolves custom-show membership, which is what makes hiding win
	 * over it: a slide pulled out of rotation stays out of the shows it is in.
	 */
	#showOrder(): number[] {
		return resolveShowSlideIndexes(
			this.#deps.getSlides(),
			this.#deps.getActiveCustomShow?.(),
			this.#deps.getAuthoredRange?.(),
		);
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
	 * A click landing on the running show's stage.
	 *
	 * PowerPoint reads an on-slide Action Setting (`a:hlinkClick`) first: the
	 * shape's link runs and the show does NOT also step on. Only what is left
	 * over reaches {@link advance}. Without this a deck navigated by its own
	 * on-slide buttons (a wheel of `ppaction://hlinksldjump` slices, say) went to
	 * the NEXT slide on every click instead of to the one that was clicked.
	 */
	handleStageClick(target: unknown): void {
		this.#applyClickHighlight(target);
		const outcome = handlePresentationStageClick(
			target,
			this.#currentSlide(),
			{ slideCount: this.#deps.getSlides().length },
			{
				goToSlide: (index) => this.#deps.navigate(index),
				move: (direction) => {
					if (direction > 0) {
						this.advance();
					} else {
						this.previousSlide();
					}
				},
				endShow: () => this.#deps.exit?.(),
				playSound: this.#deps.onPlayActionSound,
				confirmUrl: this.#deps.confirmUrl,
				// Wave-4 B7: the six action verbs added alongside the Action
				// Settings panel's new option list; built in a sibling module to
				// keep this file under the repo's file-size budget.
				...buildWaveFourActionCallbacks(
					this.#deps,
					() => this.#lastViewedIndex,
					(next) => {
						this.#customShowReturn = next;
					},
				),
			},
		);
		if (outcome === 'advance') {
			this.advance(true);
		}
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
		const current = this.#deps.getCurrentIndex();
		const order = this.#showOrder();
		if (!hasShowSlideAfter(current, order)) {
			// Wave-4 B7: a `ppaction://customshow?...&return=true` sub-show running
			// off its end returns to the show it interrupted, at the slide it
			// interrupted, instead of raising the black end screen.
			if (this.#customShowReturn) {
				const { previousId, originIndex } = this.#customShowReturn;
				this.#customShowReturn = null;
				this.#deps.setActiveCustomShowId?.(previousId);
				this.#deps.navigate(originIndex);
				return;
			}
			if (this.#deps.getLoopContinuously?.()) {
				// PowerPoint's "Loop continuously until 'Esc'": wrap straight back to
				// the show's first slide instead of the black end screen.
				const first = firstShowSlideIndex(order);
				if (first !== undefined) {
					this.#deps.navigate(first);
				}
				return;
			}
			if (this.#deps.getEndWithBlackSlide?.() === false) {
				// No black slide configured: end the show outright rather than
				// sitting on the last slide ignoring every further advance.
				this.#deps.exit?.();
			} else {
				this.#endOfShow = true;
			}
			return;
		}
		this.#deps.navigate(nextShowSlideIndex(current, order) ?? current);
	}

	/**
	 * Backward slide change, skipping hidden slides. Called only after
	 * {@link retreat} declines (it owns the end screen and the replay of a slide
	 * entered backward). Stays put at the start of the show: PowerPoint never
	 * wraps a backward press off the first slide.
	 */
	previousSlide(): void {
		const current = this.#deps.getCurrentIndex();
		const previous = previousShowSlideIndex(current, this.#showOrder());
		if (previous !== undefined && previous !== current) {
			this.#deps.navigate(previous);
		}
	}

	/**
	 * The deck index the show should OPEN on when entered from `activeIndex`
	 * (wave-4 B1): `activeIndex` itself when the show includes it ("From
	 * Current Slide"), otherwise the nearest show slide, per
	 * `presentationEntrySlideIndex`. Every entry point (status-bar button,
	 * ribbon From Current Slide, `setMode('present')`, the mobile toolbar) must
	 * seed the presentation index with this instead of the raw active slide, or
	 * a deck authored with a `p:showPr/p:sldRg` range (or a custom show that
	 * excludes the active slide) opens on a slide the show does not include.
	 */
	entryIndex(activeIndex: number): number {
		return presentationEntrySlideIndex(activeIndex, this.#showOrder());
	}

	/** Home: the show's first slide, which is not slide 1 when that one is hidden. */
	firstSlide(): void {
		const first = firstShowSlideIndex(this.#showOrder());
		if (first !== undefined) {
			this.#deps.navigate(first);
		}
	}

	/** End: the show's last slide, skipping trailing hidden slides. */
	lastSlide(): void {
		const last = lastShowSlideIndex(this.#showOrder());
		if (last !== undefined) {
			this.#deps.navigate(last);
		}
	}

	/**
	 * Raise the black end-of-slide-show screen without ending anything.
	 *
	 * Used by an audience display when the presenter ends the session and the
	 * browser refuses to close the tab: the room sees the end screen, never the
	 * editor.
	 */
	showEndOfShow(): void {
		this.#endOfShow = true;
	}

	/**
	 * Backward input. Dismisses the end screen when it is up; on a slide entered
	 * backward it replays that slide's builds from the start rather than leaving
	 * it, so a presenter who overshot can watch the build again (PowerPoint).
	 * Returns true when the press was consumed here.
	 */
	retreat(): boolean {
		if (this.#endOfShow) {
			this.#endOfShow = false;
			return true;
		}
		if (this.playback.seededCompleted) {
			this.playback.reset();
			return true;
		}
		return false;
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
		// Presentation EXIT (never a slide change, which goes through
		// `onSlideChange`): cross-slide "play across slides" audio ends with the
		// show it belongs to, and so does a transition sound flagged "Loop Until
		// Next Sound" (it otherwise keeps looping on the shared per-effect
		// singleton behind the editor).
		stopAllPersistentAudio();
		stopAnimationSound();
	}

	/**
	 * The presented slide changed: reset the new slide's builds and, when the
	 * incoming slide carries a real transition, play it over the frame.
	 */
	onSlideChange(previousIndex: number, nextIndex: number): void {
		this.#endOfShow = false;
		// Wave-4 B7: the slide the audience was just looking at, for
		// `ppaction://hlinkshowjump?jump=lastslideviewed`.
		this.#lastViewedIndex = previousIndex;
		// PowerPoint shows a slide you step BACK onto with its builds already
		// played; only a forward step replays them.
		this.playback.reset({ completed: nextIndex < previousIndex });
		const slides = this.#deps.getSlides();
		const incoming = slides[nextIndex];
		// Forward steps play the ENTERING slide's transition; a backward step
		// replays the LEAVING slide's transition in reverse (a morph glides its
		// shapes back to where they came from).
		const transition = (nextIndex < previousIndex ? slides[previousIndex] : incoming)?.transition;
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
