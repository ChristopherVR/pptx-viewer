/**
 * `useAnimationPlayback`: native-timing (`p:timing`) animation playback for Vue
 * presentation mode, driven by the shared, framework-agnostic
 * {@link PresentationAnimationController}.
 *
 * This replaces the older preset (`PptxElementAnimation`) click-group model for
 * the slide show: the controller builds a {@link TimelineEngine} from the
 * slide's `nativeAnimations` (expanding staged text builds), which can represent
 * native staged chart / SmartArt builds (`p:bldChart` / `p:bldDgm`) and colour
 * animations (`p:animClr`) that the preset model could not. It mirrors the React
 * binding's `presentation-mode/useAnimationPlayback`.
 *
 * The composable owns the reactive per-element state map, the keyframes CSS, and
 * the interactive / hover trigger-shape id sets; the controller stays pure. The
 * clock (timers, requestAnimationFrame) + DOM step/build/auto-advance effects are
 * the shared `pptx-viewer-shared` `animation-playback-engine` (formerly a local
 * `composables/animation-playback-helpers` copy, hand-ported from React and
 * near-identical across all five bindings); this composable supplies the
 * `playSound` / `stopSound` host hooks it needs (Vue's own `./animation-sound`)
 * and the reactive `Map` + `Ref`s the shared engine's callbacks write into.
 *
 * NOTE: the editor / inspector animation PREVIEW still uses the older shared
 * `buildClickGroups` model; those exports are re-exported below unchanged.
 *
 * @module composables/useAnimationPlayback
 */

import type { PptxSlide } from 'pptx-viewer-core';
import {
	cancelBuildReveal,
	playGroup,
	PresentationAnimationController,
	scheduleAutoAdvanceChain,
} from 'pptx-viewer-shared';
import type { BuildRafHandle, ElementAnimationState, PlaybackContext } from 'pptx-viewer-shared';
import { onScopeDispose, ref, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

import { playAnimationSound, stopAnimationSound } from './animation-sound';

// Re-export the older preset click-group model so existing importers (the editor
// animation preview + the unstable composable surface) keep working unchanged.
export type { AnimationClickGroup, CSSProperties } from 'pptx-viewer-shared';
export { buildClickGroups } from 'pptx-viewer-shared';

export interface UseAnimationPlaybackOptions {
	/** The active slide to build the native-animation timeline for. */
	slide: MaybeRefOrGetter<PptxSlide | undefined>;
	/** Presentation-level switch parsed from `p:showPr`. */
	showWithAnimation?: MaybeRefOrGetter<boolean | undefined>;
	/** Host-provided action-sound player (resolves + plays embedded sounds). */
	onPlayActionSound?: (soundPath: string) => void;
	/** Root element to scope media-command (`p:cmd`) target lookups to. */
	frameRoot?: () => HTMLElement | null;
}

export interface UseAnimationPlaybackResult {
	/** Reactive per-element native-animation state, keyed by element id. */
	presentationElementStates: Ref<Map<string, ElementAnimationState>>;
	/** The `@keyframes` CSS to inject once per slide. */
	presentationKeyframesCss: Ref<string>;
	/** Shape ids that trigger an interactive (`onShapeClick`) sequence. */
	interactiveTriggerShapeIds: Ref<ReadonlySet<string>>;
	/** Shape ids that trigger a hover (`onHover`) sequence. */
	hoverTriggerShapeIds: Ref<ReadonlySet<string>>;
	/** True when the main timeline has no more click-groups to reveal. */
	isComplete: Ref<boolean>;
	/**
	 * True while the active slide shows its builds as already complete because
	 * the presenter stepped BACKWARD onto it. The next back press replays the
	 * slide instead of leaving it (PowerPoint's behaviour).
	 */
	seededCompleted: Ref<boolean>;
	/** Seed the NEXT slide change as fully built (a backward step). */
	markNextEntryCompleted: () => void;
	/**
	 * Reveal the next click-group. Returns `true` if a group was revealed, `false`
	 * when playback is complete or animations are disabled (so the caller can fall
	 * through to slide navigation).
	 */
	advance: () => boolean;
	/** Rebuild the controller for the current slide and replay from the start. */
	reset: () => void;
	/** Play an interactive shape's sequence; `true` when it triggered one. */
	handleInteractiveShapeClick: (shapeId: string) => boolean;
	/** Play a hover shape's sequence; `true` when it triggered one. */
	handleHoverStart: (shapeId: string) => boolean;
	/** Reset a hover shape's sequence so the next hover replays it. */
	handleHoverEnd: (shapeId: string) => void;
	/** Clear all pending timers + the in-flight staged-build RAF. */
	clearTimers: () => void;
}

export function useAnimationPlayback(
	options: UseAnimationPlaybackOptions,
): UseAnimationPlaybackResult {
	const presentationElementStates = shallowRef<Map<string, ElementAnimationState>>(new Map());
	const presentationKeyframesCss = shallowRef('');
	const interactiveTriggerShapeIds = shallowRef<ReadonlySet<string>>(new Set());
	const hoverTriggerShapeIds = shallowRef<ReadonlySet<string>>(new Set());
	const isComplete = shallowRef(true);

	let controller: PresentationAnimationController | null = null;
	const timers: number[] = [];
	const buildHandle: BuildRafHandle = { current: null };

	const ctx: PlaybackContext = {
		setStates: (updater) => {
			presentationElementStates.value = updater(presentationElementStates.value);
		},
		timers,
		buildHandle,
		onPlayActionSound: options.onPlayActionSound,
		playSound: playAnimationSound,
		stopSound: stopAnimationSound,
		frameRoot: options.frameRoot,
	};

	const animationsEnabled = (): boolean => toValue(options.showWithAnimation) !== false;

	function clearTimers(): void {
		for (const timer of timers) {
			window.clearTimeout(timer);
		}
		timers.length = 0;
		cancelBuildReveal(buildHandle);
	}

	function syncComplete(): void {
		isComplete.value = !controller || !controller.hasMoreSteps();
	}

	/**
	 * Whether the active slide is showing its builds as already complete because
	 * the presenter stepped BACKWARD onto it. The next back press replays them.
	 */
	const seededCompleted = ref(false);
	/**
	 * Set by the host just before a BACKWARD slide change so the reseed that the
	 * slide watcher fires seeds the incoming slide as fully built.
	 */
	let pendingCompletedEntry = false;

	function resetForSlide(options2?: { completed?: boolean }): void {
		clearTimers();
		seededCompleted.value = false;
		const slide = toValue(options.slide);
		if (!slide || !animationsEnabled()) {
			controller = null;
			presentationElementStates.value = new Map();
			presentationKeyframesCss.value = '';
			interactiveTriggerShapeIds.value = new Set();
			hoverTriggerShapeIds.value = new Set();
			isComplete.value = true;
			return;
		}

		// The controller builds the timeline engine (expanding text-build
		// animations) and derives keyframes CSS, trigger-shape ids, and the full
		// tracked element id list.
		controller = PresentationAnimationController.fromSlide(slide);
		presentationKeyframesCss.value = controller.keyframesCss;
		interactiveTriggerShapeIds.value = controller.interactiveTriggerShapeIds;
		hoverTriggerShapeIds.value = controller.hoverTriggerShapeIds;
		presentationElementStates.value = controller.computeStates();
		syncComplete();

		// Stepping backward onto a slide shows it with every build already
		// complete, the way PowerPoint does: nothing plays, nothing is scheduled,
		// and a further back press replays the slide from the start.
		if (options2?.completed) {
			seededCompleted.value = controller.hasMoreSteps();
			controller.completeAll();
			presentationElementStates.value = controller.computeStates();
			syncComplete();
			return;
		}

		// Auto-play the first group when the slide opens with a withPrevious /
		// afterPrevious / afterDelay build (mirrors React's entrance auto-play).
		if (controller.hasMoreSteps()) {
			const firstGroup = controller.peekNext();
			if (firstGroup?.autoAdvance) {
				const activeController = controller;
				const timer = window.setTimeout(() => {
					const group = activeController.advance();
					if (group) {
						playGroup(activeController, group, ctx);
						scheduleAutoAdvanceChain(activeController, ctx);
						syncComplete();
					}
				}, firstGroup.autoAdvanceDelayMs ?? 0);
				timers.push(timer);
			}
		}
	}

	function advance(): boolean {
		if (!animationsEnabled() || !controller || !controller.hasMoreSteps()) {
			return false;
		}
		const group = controller.advance();
		if (!group) {
			return false;
		}
		playGroup(controller, group, ctx);
		scheduleAutoAdvanceChain(controller, ctx);
		syncComplete();
		return true;
	}

	function handleInteractiveShapeClick(shapeId: string): boolean {
		if (!controller || !controller.hasInteractiveSequence(shapeId)) {
			return false;
		}
		const group = controller.advanceInteractive(shapeId);
		if (!group) {
			return false;
		}
		playGroup(controller, group, ctx);
		return true;
	}

	function handleHoverStart(shapeId: string): boolean {
		if (!animationsEnabled() || !controller || !controller.hasHoverSequence(shapeId)) {
			return false;
		}
		// Reset first so hovering again replays the sequence from the start.
		controller.resetHover(shapeId);
		const group = controller.advanceHover(shapeId);
		if (!group) {
			return false;
		}
		playGroup(controller, group, ctx);
		return true;
	}

	function handleHoverEnd(shapeId: string): void {
		if (controller?.hasHoverSequence(shapeId)) {
			controller.resetHover(shapeId);
		}
	}

	// Rebuild whenever the active slide (or the animation switch) changes.
	watch(
		() => [toValue(options.slide), toValue(options.showWithAnimation)] as const,
		() => {
			const completed = pendingCompletedEntry;
			pendingCompletedEntry = false;
			resetForSlide({ completed });
		},
		{ immediate: true },
	);

	onScopeDispose(clearTimers);

	return {
		presentationElementStates,
		presentationKeyframesCss,
		interactiveTriggerShapeIds,
		hoverTriggerShapeIds,
		isComplete,
		seededCompleted,
		/** Seed the NEXT slide change as fully built (a backward step). */
		markNextEntryCompleted: (): void => {
			pendingCompletedEntry = true;
		},
		advance,
		reset: resetForSlide,
		handleInteractiveShapeClick,
		handleHoverStart,
		handleHoverEnd,
		clearTimers,
	};
}
