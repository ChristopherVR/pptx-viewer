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
 * / auto-advance DOM glue is the shared `animation-playback-engine`
 * (`pptx-viewer-shared`), the same clock Vue, Svelte and Vanilla run. Angular
 * used to keep a hand-ported copy of it here, which drifted: it dropped the
 * staged-build reveal fields on every step write, so a `p:bldDgm` diagram
 * popped fully in the moment its first stage's fade ended.
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

import {
	advanceMainSequence,
	clearPlaybackTimers,
	createActiveAnimationGroup,
	playGroup,
	PresentationAnimationController,
	resolveMediaTimeNodeElementIds,
	scheduleAutoAdvanceChain,
} from '../internal/shared';
import type { BuildRafHandle, ElementAnimationState, PlaybackContext } from '../internal/shared';
import { playAnimationSound, stopAnimationSound } from './animation-sound';

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
	/**
	 * The click-group the last presenter click started, so a second click while
	 * it is still mid-flight fast-forwards it (`p:seq/@nextAc="seek"`) instead
	 * of skipping to the next group. Owned here, mutated by the shared helpers.
	 */
	private readonly activeGroup = createActiveAnimationGroup();
	private showWithAnimation: boolean | undefined = undefined;
	private frameRoot: (() => HTMLElement | null) | undefined;
	private onPlayActionSound: ((soundPath: string) => void) | undefined;
	private applyStyles: (() => void) | undefined;

	private readonly ctx: PlaybackContext = {
		setStates: (updater) => {
			this.presentationElementStates.set(updater(this.presentationElementStates()));
			// Stamp the DOM NOW, in the same task as the input that caused the step.
			// The overlay also applies the state reactively (effect -> afterNextRender),
			// but that lands one change-detection cycle plus one render hook later:
			// measured at ~24ms (1.5 frames) after the ArrowRight that starts a
			// click-group, where React / Vue / Svelte / Vanilla all have the
			// animation on the element within the key handler's own task. The delay
			// is a real dropped frame at the start of every entrance, and it makes
			// the show observably lag its own input (`e2e/animation-entry-state.spec.ts`
			// reads the inline `animation` right after the key press and saw nothing).
			// Only playback steps route through here; the per-slide seed in
			// `setSlide` deliberately does not (see `onlyWhenStaged`).
			this.applyStyles?.();
		},
		timers: this.timers,
		buildHandle: this.buildHandle,
		// The host override is registered after construction, so resolve it per
		// call; with none registered the local player takes over (the old local
		// copy of the engine silently dropped the sound in that case).
		onPlayActionSound: (soundPath: string) => {
			(this.onPlayActionSound ?? playAnimationSound)(soundPath);
		},
		playSound: playAnimationSound,
		stopSound: stopAnimationSound,
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

	/**
	 * Register the DOM applier that stamps the element states onto the rendered
	 * stage ({@link PresentationStageAnimator.applyAnimationStyles}). It is run
	 * SYNCHRONOUSLY on every playback state change, so a click-advance starts its
	 * entrance in the same task as the key press instead of waiting for Angular's
	 * next change-detection + render pass. Pass an applier that no-ops while the
	 * stage still shows another slide (`onlyWhenStaged`).
	 */
	setStyleApplier(apply: () => void): void {
		this.applyStyles = apply;
	}

	private animationsEnabled(): boolean {
		return this.showWithAnimation !== false;
	}

	/** Clear all pending timers + the in-flight staged-build RAF. */
	clearTimers(): void {
		clearPlaybackTimers(this.ctx, this.activeGroup);
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
	setSlide(
		slide: PptxSlide | undefined,
		showWithAnimation?: boolean,
		options?: { completed?: boolean },
	): void {
		this.showWithAnimation = showWithAnimation;
		this.clearTimers();
		this.seededCompleted = false;

		if (!slide || !this.animationsEnabled()) {
			this.controller = null;
			this.ctx.mediaTimeNodeElementIds = new Map();
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
		// Lets a `p:cond/@evt="onStopAudio"`-gated step gate on the REAL media
		// element's `ended` event instead of only its estimated `delayMs`.
		this.ctx.mediaTimeNodeElementIds = resolveMediaTimeNodeElementIds(slide.nativeAnimations ?? []);
		this.keyframesCss.set(controller.keyframesCss);
		this.interactiveTriggerShapeIds.set(controller.interactiveTriggerShapeIds);
		this.hoverTriggerShapeIds.set(controller.hoverTriggerShapeIds);
		this.presentationElementStates.set(controller.computeStates());
		this.syncComplete();

		// Stepping backward onto a slide shows it with every build already
		// complete, the way PowerPoint does: nothing plays, nothing is scheduled,
		// and a further back press replays the slide from the start.
		if (options?.completed) {
			this.seededCompleted = controller.hasMoreSteps();
			controller.completeAll();
			this.presentationElementStates.set(controller.computeStates());
			this.syncComplete();
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
						playGroup(controller, group, this.ctx);
						scheduleAutoAdvanceChain(controller, this.ctx);
						this.syncComplete();
					}
				}, firstGroup.autoAdvanceDelayMs ?? 0);
				this.timers.push(timer);
			}
		}
	}

	/**
	 * True while the active slide shows its builds as already complete because
	 * the presenter stepped BACKWARD onto it. The next back press replays the
	 * slide instead of leaving it (PowerPoint's behaviour).
	 */
	private seededCompleted = false;

	/** Whether the active slide was seeded as fully built (backward entry). */
	isSeededCompleted(): boolean {
		return this.seededCompleted;
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
		if (!this.animationsEnabled()) {
			return false;
		}
		// Seek-or-advance (`p:seq/@nextAc="seek"`) plus the auto-advance chain
		// live in shared, so the branch is identical in all five bindings.
		const consumed = advanceMainSequence(this.controller, this.ctx, this.activeGroup);
		this.syncComplete();
		return consumed;
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
