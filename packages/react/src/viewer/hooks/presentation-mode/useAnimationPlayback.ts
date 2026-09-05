import type { PptxSlide } from 'pptx-viewer-core';
import type { PlaybackContext } from 'pptx-viewer-shared';
import {
	advanceMainSequence,
	cancelBuildReveal,
	clearPlaybackTimers,
	createActiveAnimationGroup,
	PresentationAnimationController,
	playGroup,
	resolveMediaTimeNodeElementIds,
} from 'pptx-viewer-shared';
import { useRef, useState, useCallback, useEffect } from 'react';

import type { PresentationAnimationRuntime } from '../../types';
import { playAnimationSound, stopAnimationSound } from '../../utils/animation-sound';
import type { ElementAnimationState } from '../../utils/animation-timeline';
import {
	scheduleEntranceAnimationTimers,
	scheduleOpeningAutoPlayGroup,
} from './entrance-animation-timers';

// ---------------------------------------------------------------------------
// Sub-hook interface
// ---------------------------------------------------------------------------

export interface UseAnimationPlaybackInput {
	slides: PptxSlide[];
	onPlayActionSound?: (soundPath: string) => void;
	/** When false, all animations are skipped (elements shown immediately). */
	showWithAnimation?: boolean;
}

/** How a slide's animation timeline should be seeded when it becomes active. */
export interface SeedSlideAnimationOptions {
	/**
	 * Seed the slide as fully built instead of playing it from the start.
	 *
	 * PowerPoint shows a slide you step BACKWARD onto with its builds already
	 * complete; a further back press then walks them off. Replaying from zero
	 * made a deck whose opening build auto-starts restart every time the
	 * presenter stepped back onto it.
	 */
	completed?: boolean;
}

export interface UseAnimationPlaybackResult {
	presentationAnimations: PresentationAnimationRuntime[];
	presentationElementStates: Map<string, ElementAnimationState>;
	presentationKeyframesCss: string;
	interactiveTriggerShapeIds: ReadonlySet<string>;
	hoverTriggerShapeIds: ReadonlySet<string>;
	clearPresentationTimers: () => void;
	playNextAnimationGroup: () => boolean;
	handleInteractiveShapeClick: (shapeId: string) => boolean;
	handleHoverStart: (shapeId: string) => boolean;
	handleHoverEnd: (shapeId: string) => void;
	runPresentationEntranceAnimations: (
		slideIndex: number,
		options?: SeedSlideAnimationOptions,
	) => void;
	/**
	 * Seed a slide's animation timeline WITHOUT starting playback: builds the
	 * controller and applies the initial element states (entrance-animated
	 * elements hidden). Must run synchronously with the slide swap so the new
	 * slide's first paint never shows animated elements at their final state.
	 */
	seedSlideAnimations: (slideIndex: number, options?: SeedSlideAnimationOptions) => void;
	/**
	 * Start playback for a previously seeded slide: schedules the opening
	 * auto-play group and the legacy entrance-animation timers. Called after the
	 * slide's transition has finished (or immediately for instant transitions).
	 */
	startSlideAnimations: (slideIndex: number) => void;
	/**
	 * True while the active slide is showing its builds as already complete
	 * because the presenter stepped backward onto it. The next backward press
	 * replays the slide instead of leaving it (PowerPoint's behaviour).
	 */
	isSeededCompleted: () => boolean;
	/** Exposed so the orchestrator can schedule additional timers (e.g. auto-advance). */
	presentationTimersRef: React.RefObject<number[]>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnimationPlayback(input: UseAnimationPlaybackInput): UseAnimationPlaybackResult {
	const { slides, onPlayActionSound, showWithAnimation } = input;
	const animationsEnabled = showWithAnimation !== false;

	// State
	const [presentationAnimations, setPresentationAnimations] = useState<
		PresentationAnimationRuntime[]
	>([]);
	const [presentationElementStates, setPresentationElementStates] = useState<
		Map<string, ElementAnimationState>
	>(new Map());
	const [presentationKeyframesCss, setPresentationKeyframesCss] = useState('');
	const [interactiveTriggerShapeIds, setInteractiveTriggerShapeIds] = useState<ReadonlySet<string>>(
		new Set(),
	);
	const [hoverTriggerShapeIds, setHoverTriggerShapeIds] = useState<ReadonlySet<string>>(new Set());

	// Refs
	const presentationTimersRef = useRef<number[]>([]);
	const controllerRef = useRef<PresentationAnimationController | null>(null);
	/** In-flight requestAnimationFrame id for the active staged-build reveal. */
	const buildRafRef = useRef<number | null>(null);
	/**
	 * Main-timeline group whose authored active window has not elapsed yet: the
	 * shared `advanceMainSequence` seeks it on a second click when the deck says
	 * `p:seq/@nextAc="seek"`. Mutated in place by the shared helpers.
	 */
	const activeAnimationGroupRef = useRef(createActiveAnimationGroup());
	/** Whether the active slide was seeded as fully built (backward entry). */
	const seededCompletedRef = useRef(false);
	/**
	 * Maps a `p:audio`/`p:video` animation's own timing-tree node id to the
	 * element id it plays, for the active slide (see
	 * `resolveMediaTimeNodeElementIds`). Lets `applyAnimationGroupSteps` gate a
	 * `p:cond/@evt="onStopAudio"` step on the REAL media element's `ended`
	 * event instead of only its estimated `delayMs`.
	 */
	const mediaTimeNodeElementIdsRef = useRef<ReadonlyMap<number, string>>(new Map());
	/**
	 * Whether the last seed REQUESTED completed entry (even when the slide had
	 * no builds): a completed entry never starts playback of any kind.
	 */
	const lastSeedCompletedRef = useRef(false);

	// -----------------------------------------------------------------------
	// Shared playback context
	//
	// The click-group step application, staged-build RAF loop, and auto-advance
	// chain live in the shared `animation-playback-engine`; this hook only
	// supplies the React state setters, timer bookkeeping, and sound callbacks
	// the engine needs. `ctx.timers` IS `presentationTimersRef.current`, which is
	// only ever cleared in place (`clearPlaybackTimers`), never reassigned, so
	// a context built before a clear stays valid afterwards.
	// -----------------------------------------------------------------------

	const buildPlaybackContext = useCallback((): PlaybackContext => {
		return {
			setStates: setPresentationElementStates,
			timers: presentationTimersRef.current,
			buildHandle: buildRafRef,
			onPlayActionSound,
			playSound: playAnimationSound,
			stopSound: stopAnimationSound,
			mediaTimeNodeElementIds: mediaTimeNodeElementIdsRef.current,
		};
	}, [onPlayActionSound]);

	// Stop the build loop on unmount so a detached RAF never touches state.
	useEffect(() => {
		return () => {
			cancelBuildReveal(buildRafRef);
		};
	}, []);

	// -----------------------------------------------------------------------
	// Timer management
	// -----------------------------------------------------------------------

	const clearPresentationTimers = useCallback(() => {
		clearPlaybackTimers(buildPlaybackContext(), activeAnimationGroupRef.current);
	}, [buildPlaybackContext]);

	// -----------------------------------------------------------------------
	// Slide timeline reset
	// -----------------------------------------------------------------------

	const resetSlideTimeline = useCallback(
		(slideIndex: number) => {
			cancelBuildReveal(buildRafRef);
			const slide = slides[slideIndex];
			if (!slide) {
				controllerRef.current = null;
				mediaTimeNodeElementIdsRef.current = new Map();
				setPresentationElementStates(new Map());
				setPresentationKeyframesCss('');
				setInteractiveTriggerShapeIds(new Set());
				setHoverTriggerShapeIds(new Set());
				return;
			}

			// The controller builds the timeline engine (expanding text-build
			// animations into sub-element animations) and derives the keyframes CSS,
			// trigger-shape id sets, and the full tracked element id list.
			const controller = PresentationAnimationController.fromSlide(slide);
			controllerRef.current = controller;
			mediaTimeNodeElementIdsRef.current = resolveMediaTimeNodeElementIds(
				slide.nativeAnimations ?? [],
			);
			setPresentationKeyframesCss(controller.keyframesCss);

			// Expose interactive and hover trigger shape IDs for cursor styling
			setInteractiveTriggerShapeIds(controller.interactiveTriggerShapeIds);
			setHoverTriggerShapeIds(controller.hoverTriggerShapeIds);

			setPresentationElementStates(controller.computeStates());
		},
		[slides],
	);

	// -----------------------------------------------------------------------
	// Main timeline animation advance
	// -----------------------------------------------------------------------

	const playNextAnimationGroup = useCallback((): boolean => {
		if (!animationsEnabled) {
			return false;
		}
		// Seek-or-advance (`p:seq/@nextAc="seek"`) plus the auto-advance chain
		// live in shared, so the branch is identical in all five bindings.
		return advanceMainSequence(
			controllerRef.current,
			buildPlaybackContext(),
			activeAnimationGroupRef.current,
		);
	}, [animationsEnabled, buildPlaybackContext]);

	// -----------------------------------------------------------------------
	// Interactive shape-click animation
	// -----------------------------------------------------------------------

	const handleInteractiveShapeClick = useCallback(
		(shapeId: string): boolean => {
			const controller = controllerRef.current;
			if (!controller || !controller.hasInteractiveSequence(shapeId)) {
				return false;
			}

			const group = controller.advanceInteractive(shapeId);
			if (!group) {
				return false;
			}

			playGroup(controller, group, buildPlaybackContext());

			return true;
		},
		[buildPlaybackContext],
	);

	// -----------------------------------------------------------------------
	// Hover animation
	// -----------------------------------------------------------------------

	const handleHoverStart = useCallback(
		(shapeId: string): boolean => {
			if (!animationsEnabled) {
				return false;
			}
			const controller = controllerRef.current;
			if (!controller || !controller.hasHoverSequence(shapeId)) {
				return false;
			}

			// Reset hover state so hovering again replays the animation
			controller.resetHover(shapeId);

			const group = controller.advanceHover(shapeId);
			if (!group) {
				return false;
			}

			playGroup(controller, group, buildPlaybackContext());

			return true;
		},
		[animationsEnabled, buildPlaybackContext],
	);

	const handleHoverEnd = useCallback((shapeId: string): void => {
		const controller = controllerRef.current;
		if (!controller || !controller.hasHoverSequence(shapeId)) {
			return;
		}

		// Reset hover sequence so next hover replays from the start
		controller.resetHover(shapeId);
	}, []);

	// -----------------------------------------------------------------------
	// Entrance animations (legacy animation[] array on a slide)
	// -----------------------------------------------------------------------

	/**
	 * Seed the slide's timeline and initial element states WITHOUT starting
	 * playback. Runs synchronously with the slide swap so the incoming slide's
	 * very first paint already has entrance-animated elements hidden; deferring
	 * this (the old behaviour deferred it past the slide transition) rendered
	 * every animated element at its FINAL state for the whole transition, then
	 * visibly snapped them back to replay ("end state flash", issue #132).
	 */
	const seedSlideAnimations = useCallback(
		(slideIndex: number, options?: SeedSlideAnimationOptions) => {
			clearPresentationTimers();
			setPresentationAnimations([]);

			// When animations are disabled, skip timeline and entrance animations
			if (!animationsEnabled) {
				controllerRef.current = null;
				setPresentationElementStates(new Map());
				setPresentationKeyframesCss('');
				setInteractiveTriggerShapeIds(new Set());
				setHoverTriggerShapeIds(new Set());
				return;
			}

			resetSlideTimeline(slideIndex);

			// Stepping backward onto a slide shows it with every build already
			// complete, the way PowerPoint does; nothing plays and nothing is
			// scheduled, so a further back press can walk the builds off.
			seededCompletedRef.current = false;
			lastSeedCompletedRef.current = options?.completed === true;
			if (options?.completed) {
				const seeded = controllerRef.current;
				if (seeded) {
					// Only a slide that actually has builds can be "already built": on
					// a slide with none, a back press should just keep going back.
					seededCompletedRef.current = seeded.hasMoreSteps();
					seeded.completeAll();
					setPresentationElementStates(seeded.computeStates());
				}
			}
		},
		[animationsEnabled, clearPresentationTimers, resetSlideTimeline],
	);

	/**
	 * Start playback for a slide previously seeded by {@link seedSlideAnimations}:
	 * schedule the opening auto-play group and the legacy entrance timers. A
	 * slide seeded as already-complete (backward entry) starts nothing.
	 */
	const startSlideAnimations = useCallback(
		(slideIndex: number) => {
			if (!animationsEnabled || lastSeedCompletedRef.current) {
				return;
			}
			const slide = slides[slideIndex];
			if (!slide) {
				return;
			}

			// The slide's opening click-group, when the deck auto-starts it.
			const controller = controllerRef.current;
			if (controller) {
				const ctx = buildPlaybackContext();
				scheduleOpeningAutoPlayGroup(controller, ctx);
			}

			// Legacy preset (`slide.animations`) entrance timers.
			scheduleEntranceAnimationTimers(slide, setPresentationAnimations, presentationTimersRef);
		},
		[animationsEnabled, slides, buildPlaybackContext],
	);

	const runPresentationEntranceAnimations = useCallback(
		(slideIndex: number, options?: SeedSlideAnimationOptions) => {
			seedSlideAnimations(slideIndex, options);
			startSlideAnimations(slideIndex);
		},
		[seedSlideAnimations, startSlideAnimations],
	);

	return {
		presentationAnimations,
		presentationElementStates,
		presentationKeyframesCss,
		interactiveTriggerShapeIds,
		hoverTriggerShapeIds,
		clearPresentationTimers,
		playNextAnimationGroup,
		handleInteractiveShapeClick,
		handleHoverStart,
		handleHoverEnd,
		runPresentationEntranceAnimations,
		seedSlideAnimations,
		startSlideAnimations,
		isSeededCompleted: () => seededCompletedRef.current,
		presentationTimersRef,
	};
}
