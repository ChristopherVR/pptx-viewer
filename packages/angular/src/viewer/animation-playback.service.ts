/**
 * animation-playback.service.ts: native-timing (`p:timing`) animation playback
 * for Angular presentation mode, driven by the shared, framework-agnostic
 * {@link PresentationAnimationController}.
 *
 * This replaces the older preset (`PptxElementAnimation`) click-group model for
 * the slide show: the controller builds a timeline engine from the slide's
 * `nativeAnimations` (expanding staged text builds), which can represent native
 * staged chart / SmartArt builds (`p:bldChart` / `p:bldDgm`) and colour
 * animations (`p:animClr`) that the preset model could not. It mirrors the Vue
 * `useAnimationPlayback` composable and the React `useAnimationPlayback` hook.
 *
 * The service owns the signal-based per-element state map, the per-slide
 * keyframes CSS, the interactive / hover trigger-shape id sets, and the clock
 * (timers + requestAnimationFrame). The controller stays pure; the step / build
 * / auto-advance DOM glue lives in {@link module:viewer/presentation-playback-helpers}.
 *
 * Provide it at the component level so its lifetime tracks the host overlay:
 * `@Component({ providers: [AnimationPlaybackService] })`.
 *
 * NOTE: the editor / inspector animation PREVIEW still uses the older shared
 * `buildClickGroups` model (see `animation-playback-helpers.ts`); that surface is
 * intentionally left unchanged.
 */

import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import { PresentationAnimationController } from '../internal/shared';
import type { ElementAnimationState } from '../internal/shared';
import type { BuildRafHandle, PlaybackContext } from './presentation-playback-helpers';
import {
	cancelBuildReveal,
	playGroup,
	scheduleAutoAdvanceChain,
} from './presentation-playback-helpers';

@Injectable()
export class AnimationPlaybackService {
	private readonly destroyRef = inject(DestroyRef);

	// ------------------------------------------------------------------
	// Reactive outputs (read by the overlay + element renderers)
	// ------------------------------------------------------------------

	/** Per-element native-animation state, keyed by element id. */
	readonly presentationElementStates = signal<Map<string, ElementAnimationState>>(new Map());
	/** The `@keyframes` CSS to inject once per slide. */
	readonly keyframesCss = signal<string>('');
	/** Shape ids that trigger an interactive (`onShapeClick`) sequence. */
	readonly interactiveTriggerShapeIds = signal<ReadonlySet<string>>(new Set());
	/** Shape ids that trigger a hover (`onHover`) sequence. */
	readonly hoverTriggerShapeIds = signal<ReadonlySet<string>>(new Set());
	/** True when the main timeline has no more click-groups to reveal. */
	readonly isComplete = signal<boolean>(true);

	// ------------------------------------------------------------------
	// Clock + controller state (imperative, non-reactive)
	// ------------------------------------------------------------------

	private controller: PresentationAnimationController | null = null;
	private readonly timers: number[] = [];
	private readonly buildHandle: BuildRafHandle = { current: null };
	private showWithAnimation: boolean | undefined = undefined;
	private frameRoot: (() => HTMLElement | null) | undefined;
	private onPlayActionSound: ((soundPath: string) => void) | undefined;

	private readonly ctx: PlaybackContext = {
		setStates: (updater) => {
			this.presentationElementStates.set(updater(this.presentationElementStates()));
		},
		timers: this.timers,
		buildHandle: this.buildHandle,
		onPlayActionSound: (soundPath: string) => this.onPlayActionSound?.(soundPath),
		frameRoot: () => this.frameRoot?.() ?? null,
	};

	constructor() {
		this.destroyRef.onDestroy(() => this.clearTimers());
	}

	// ------------------------------------------------------------------
	// Host wiring
	// ------------------------------------------------------------------

	/** Scope media-command (`p:cmd`) target lookups to a stage root element. */
	setFrameRoot(root: () => HTMLElement | null): void {
		this.frameRoot = root;
	}

	/** Register a host-provided action-sound player (embedded-sound resolution). */
	setActionSoundHandler(handler: ((soundPath: string) => void) | undefined): void {
		this.onPlayActionSound = handler;
	}

	private animationsEnabled(): boolean {
		return this.showWithAnimation !== false;
	}

	/** Clear all pending timers + the in-flight staged-build RAF. */
	clearTimers(): void {
		for (const timer of this.timers) {
			window.clearTimeout(timer);
		}
		this.timers.length = 0;
		cancelBuildReveal(this.buildHandle);
	}

	private syncComplete(): void {
		this.isComplete.set(!this.controller || !this.controller.hasMoreSteps());
	}

	// ------------------------------------------------------------------
	// Slide timeline reset
	// ------------------------------------------------------------------

	/**
	 * Rebuild the controller for `slide` and seed the initial element state
	 * (entrance-animated elements start hidden). Auto-plays the first click-group
	 * when the slide opens with a withPrevious / afterPrevious / afterDelay build.
	 */
	setSlide(slide: PptxSlide | undefined, showWithAnimation?: boolean): void {
		this.showWithAnimation = showWithAnimation;
		this.clearTimers();

		if (!slide || !this.animationsEnabled()) {
			this.controller = null;
			this.presentationElementStates.set(new Map());
			this.keyframesCss.set('');
			this.interactiveTriggerShapeIds.set(new Set());
			this.hoverTriggerShapeIds.set(new Set());
			this.isComplete.set(true);
			return;
		}

		// The controller builds the timeline engine (expanding text-build
		// animations) and derives keyframes CSS, trigger-shape ids, and the full
		// tracked element id list.
		const controller = PresentationAnimationController.fromSlide(slide);
		this.controller = controller;
		this.keyframesCss.set(controller.keyframesCss);
		this.interactiveTriggerShapeIds.set(controller.interactiveTriggerShapeIds);
		this.hoverTriggerShapeIds.set(controller.hoverTriggerShapeIds);
		this.presentationElementStates.set(controller.computeStates());
		this.syncComplete();

		// Auto-play the first group when the slide opens with a withPrevious /
		// afterPrevious / afterDelay build (mirrors React's entrance auto-play).
		if (controller.hasMoreSteps()) {
			const firstGroup = controller.peekNext();
			if (firstGroup?.autoAdvance) {
				const timer = window.setTimeout(() => {
					const group = controller.advance();
					if (group) {
						playGroup(controller, group, this.ctx);
						scheduleAutoAdvanceChain(controller, this.ctx);
						this.syncComplete();
					}
				}, firstGroup.autoAdvanceDelayMs ?? 0);
				this.timers.push(timer);
			}
		}
	}

	// ------------------------------------------------------------------
	// Playback controls
	// ------------------------------------------------------------------

	/**
	 * Reveal the next click-group. Returns `true` if a group was revealed, `false`
	 * when playback is complete or animations are disabled (so the caller can fall
	 * through to slide navigation).
	 */
	advance(): boolean {
		const controller = this.controller;
		if (!this.animationsEnabled() || !controller || !controller.hasMoreSteps()) {
			return false;
		}
		const group = controller.advance();
		if (!group) {
			return false;
		}
		playGroup(controller, group, this.ctx);
		scheduleAutoAdvanceChain(controller, this.ctx);
		this.syncComplete();
		return true;
	}

	/** Play an interactive shape's sequence; `true` when it triggered one. */
	handleInteractiveShapeClick(shapeId: string): boolean {
		const controller = this.controller;
		if (!controller || !controller.hasInteractiveSequence(shapeId)) {
			return false;
		}
		const group = controller.advanceInteractive(shapeId);
		if (!group) {
			return false;
		}
		playGroup(controller, group, this.ctx);
		return true;
	}

	/** Play a hover shape's sequence; `true` when it triggered one. */
	handleHoverStart(shapeId: string): boolean {
		const controller = this.controller;
		if (!this.animationsEnabled() || !controller || !controller.hasHoverSequence(shapeId)) {
			return false;
		}
		// Reset first so hovering again replays the sequence from the start.
		controller.resetHover(shapeId);
		const group = controller.advanceHover(shapeId);
		if (!group) {
			return false;
		}
		playGroup(controller, group, this.ctx);
		return true;
	}

	/** Reset a hover shape's sequence so the next hover replays it. */
	handleHoverEnd(shapeId: string): void {
		if (this.controller?.hasHoverSequence(shapeId)) {
			this.controller.resetHover(shapeId);
		}
	}
}
