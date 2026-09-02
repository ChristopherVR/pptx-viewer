import type { PptxSlide } from 'pptx-viewer-core';
import type { BuildRafHandle, ElementAnimationState, PlaybackContext } from 'pptx-viewer-shared';
import {
	cancelBuildReveal,
	playGroup,
	PresentationAnimationController,
	scheduleAutoAdvanceChain,
} from 'pptx-viewer-shared';

import { playAnimationSound, stopAnimationSound } from './animation-sound';

/**
 * `AnimationPlayback`: native-timing (`p:timing`) animation playback for the
 * Svelte binding's presentation mode, driven by the shared, framework-agnostic
 * {@link PresentationAnimationController}. The runes analogue of the Vue
 * `useAnimationPlayback` composable, kept out of the SFC so it is unit-testable.
 *
 * This replaces the older preset (`PptxElementAnimation`) click-group model for
 * the slide show: the controller builds a timeline engine from the slide's
 * `nativeAnimations` (expanding staged text builds), which can represent native
 * staged chart / SmartArt builds (`p:bldChart` / `p:bldDgm`) and colour
 * animations (`p:animClr`) that the preset model could not. It mirrors the Vue /
 * React bindings.
 *
 * The class owns the reactive per-element state map, the keyframes CSS, and the
 * interactive / hover trigger-shape id sets; the controller stays pure. The
 * clock (timers, requestAnimationFrame) + DOM effects live in the shared
 * {@link module:render/animation-playback-engine}, wired here with the local
 * `./animation-sound` player.
 *
 * NOTE: the editor / inspector animation PREVIEW still uses the older shared
 * `buildClickGroups` model (see `AnimationsTab` / `editor-animation-controller`);
 * this class is only the running slide show.
 */
export interface AnimationPlaybackDeps {
	/** The current slide to build the native-animation timeline for. */
	getSlide(): PptxSlide | undefined;
	/** Presentation-level switch parsed from `p:showPr`. */
	getShowWithAnimation?(): boolean | undefined;
	/** Host-provided action-sound player (resolves + plays embedded sounds). */
	onPlayActionSound?: (soundPath: string) => void;
	/** Root element to scope media-command (`p:cmd`) target lookups to. */
	frameRoot?: () => HTMLElement | null;
}

export class AnimationPlayback {
	/** Reactive per-element native-animation state, keyed by element id. */
	#states = $state<Map<string, ElementAnimationState>>(new Map());
	/** The per-slide `@keyframes` CSS to inject (empty when nothing animates). */
	#keyframesCss = $state('');
	/** Shape ids that trigger an interactive (`onShapeClick`) sequence. */
	#interactiveTriggerShapeIds = $state<ReadonlySet<string>>(new Set());
	/** Shape ids that trigger a hover (`onHover`) sequence. */
	#hoverTriggerShapeIds = $state<ReadonlySet<string>>(new Set());
	/** True once the main timeline has no more click-groups to reveal. */
	#complete = $state(true);

	readonly #deps: AnimationPlaybackDeps;
	#controller: PresentationAnimationController | null = null;
	readonly #timers: number[] = [];
	readonly #buildHandle: BuildRafHandle = { current: null };
	readonly #ctx: PlaybackContext;

	constructor(deps: AnimationPlaybackDeps) {
		this.#deps = deps;
		this.#ctx = {
			setStates: (updater) => {
				this.#states = updater(this.#states);
			},
			timers: this.#timers,
			buildHandle: this.#buildHandle,
			onPlayActionSound: deps.onPlayActionSound,
			playSound: playAnimationSound,
			stopSound: stopAnimationSound,
			frameRoot: deps.frameRoot,
		};
	}

	/** Reactive per-element native-animation state (visibility, build, colour). */
	get elementStates(): Map<string, ElementAnimationState> {
		return this.#states;
	}

	/** The per-slide `@keyframes` CSS to inject once per slide. */
	get keyframesCss(): string {
		return this.#keyframesCss;
	}

	/** Shape ids that trigger an interactive (`onShapeClick`) sequence. */
	get interactiveTriggerShapeIds(): ReadonlySet<string> {
		return this.#interactiveTriggerShapeIds;
	}

	/** Shape ids that trigger a hover (`onHover`) sequence. */
	get hoverTriggerShapeIds(): ReadonlySet<string> {
		return this.#hoverTriggerShapeIds;
	}

	/** True once every main-timeline click-group has been revealed. */
	get isComplete(): boolean {
		return this.#complete;
	}

	#animationsEnabled(): boolean {
		return this.#deps.getShowWithAnimation?.() !== false;
	}

	#syncComplete(): void {
		this.#complete = !this.#controller || !this.#controller.hasMoreSteps();
	}

	/** Clear all pending timers + the in-flight staged-build RAF. */
	clearTimers(): void {
		for (const timer of this.#timers) {
			window.clearTimeout(timer);
		}
		this.#timers.length = 0;
		cancelBuildReveal(this.#buildHandle);
	}

	/**
	 * True while the active slide shows its builds as already complete because
	 * the presenter stepped BACKWARD onto it. The next back press replays it.
	 */
	#seededCompleted = false;

	/** Whether the active slide was seeded as fully built (backward entry). */
	get seededCompleted(): boolean {
		return this.#seededCompleted;
	}

	/**
	 * Rebuild the controller for the current slide and replay from the start. The
	 * controller builds the timeline engine (expanding text-build animations) and
	 * derives keyframes CSS, trigger-shape ids, and the tracked element id list.
	 */
	reset(options?: { completed?: boolean }): void {
		this.clearTimers();
		this.#seededCompleted = false;
		const slide = this.#deps.getSlide();
		if (!slide || !this.#animationsEnabled()) {
			this.#controller = null;
			this.#states = new Map();
			this.#keyframesCss = '';
			this.#interactiveTriggerShapeIds = new Set();
			this.#hoverTriggerShapeIds = new Set();
			this.#complete = true;
			return;
		}

		const controller = PresentationAnimationController.fromSlide(slide);
		this.#controller = controller;
		this.#keyframesCss = controller.keyframesCss;
		this.#interactiveTriggerShapeIds = controller.interactiveTriggerShapeIds;
		this.#hoverTriggerShapeIds = controller.hoverTriggerShapeIds;
		this.#states = controller.computeStates();
		this.#syncComplete();

		// Stepping backward onto a slide shows it with every build already
		// complete, the way PowerPoint does: nothing plays, nothing is scheduled,
		// and a further back press replays the slide from the start.
		if (options?.completed) {
			this.#seededCompleted = controller.hasMoreSteps();
			controller.completeAll();
			this.#states = controller.computeStates();
			this.#syncComplete();
			return;
		}

		// Auto-play the first group when the slide opens with a withPrevious /
		// afterPrevious / afterDelay build (mirrors React's entrance auto-play).
		if (controller.hasMoreSteps()) {
			const firstGroup = controller.peekNext();
			if (firstGroup?.autoAdvance) {
				const timer = window.setTimeout(() => {
					const group = controller.advance();
					if (group) {
						playGroup(controller, group, this.#ctx);
						scheduleAutoAdvanceChain(controller, this.#ctx);
						this.#syncComplete();
					}
				}, firstGroup.autoAdvanceDelayMs ?? 0);
				this.#timers.push(timer);
			}
		}
	}

	/**
	 * Reveal the next click-group. Returns `true` if a group was revealed, `false`
	 * when playback is complete or animations are disabled (so the caller can fall
	 * through to slide navigation).
	 */
	advance(): boolean {
		if (!this.#animationsEnabled() || !this.#controller || !this.#controller.hasMoreSteps()) {
			return false;
		}
		const group = this.#controller.advance();
		if (!group) {
			return false;
		}
		playGroup(this.#controller, group, this.#ctx);
		scheduleAutoAdvanceChain(this.#controller, this.#ctx);
		this.#syncComplete();
		return true;
	}

	/** Play an interactive shape's sequence; `true` when it triggered one. */
	handleInteractiveShapeClick(shapeId: string): boolean {
		if (!this.#controller || !this.#controller.hasInteractiveSequence(shapeId)) {
			return false;
		}
		const group = this.#controller.advanceInteractive(shapeId);
		if (!group) {
			return false;
		}
		playGroup(this.#controller, group, this.#ctx);
		return true;
	}

	/** Play a hover shape's sequence; `true` when it triggered one. */
	handleHoverStart(shapeId: string): boolean {
		if (
			!this.#animationsEnabled() ||
			!this.#controller ||
			!this.#controller.hasHoverSequence(shapeId)
		) {
			return false;
		}
		// Reset first so hovering again replays the sequence from the start.
		this.#controller.resetHover(shapeId);
		const group = this.#controller.advanceHover(shapeId);
		if (!group) {
			return false;
		}
		playGroup(this.#controller, group, this.#ctx);
		return true;
	}

	/** Reset a hover shape's sequence so the next hover replays it. */
	handleHoverEnd(shapeId: string): void {
		if (this.#controller?.hasHoverSequence(shapeId)) {
			this.#controller.resetHover(shapeId);
		}
	}
}
