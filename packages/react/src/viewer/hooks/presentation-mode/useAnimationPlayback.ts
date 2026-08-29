import type { PptxSlide } from 'pptx-viewer-core';
import { PresentationAnimationController } from 'pptx-viewer-shared';
import { useRef, useState, useCallback, useEffect } from 'react';

import type { PresentationAnimationRuntime } from '../../types';
import type { ElementAnimationState, TimelineClickGroup } from '../../utils/animation-timeline';
import {
	applyAnimationGroupSteps,
	finishAnimationGroupSteps,
	finishDomAnimationsForGroup,
	shouldSeekAnimationGroup,
} from './animation-helpers';
import { driveBuildReveal, cancelBuildReveal } from './build-playback';
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
	/** Main-timeline group whose authored active window has not elapsed yet. */
	const activeAnimationGroupRef = useRef<TimelineClickGroup | null>(null);
	const activeAnimationEndAtRef = useRef(0);
	/** Whether the active slide was seeded as fully built (backward entry). */
	const seededCompletedRef = useRef(false);
	/**
	 * Whether the last seed REQUESTED completed entry (even when the slide had
	 * no builds): a completed entry never starts playback of any kind.
	 */
	const lastSeedCompletedRef = useRef(false);

	// -----------------------------------------------------------------------
	// Staged chart / SmartArt build reveal (RAF-driven)
	// -----------------------------------------------------------------------

	/**
	 * Start (or restart) the requestAnimationFrame loop that ramps a click-group's
	 * staged-build `progress` from 0 -> 1. No-op when the group carries no build
	 * step, so ordinary click-advance is unchanged.
	 */
	const startBuildReveal = useCallback(
		(controller: PresentationAnimationController, group: TimelineClickGroup) => {
			driveBuildReveal(
				controller,
				PresentationAnimationController.collectBuildStepIds(group),
				setPresentationElementStates,
				buildRafRef,
			);
		},
		[],
	);

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
		presentationTimersRef.current.forEach((timer) => {
			window.clearTimeout(timer);
		});
		presentationTimersRef.current = [];
		cancelBuildReveal(buildRafRef);
		activeAnimationGroupRef.current = null;
		activeAnimationEndAtRef.current = 0;
	}, []);

	const markAnimationGroupActive = useCallback((group: TimelineClickGroup) => {
		activeAnimationGroupRef.current = group;
		activeAnimationEndAtRef.current = performance.now() + Math.max(0, group.totalDurationMs);
	}, []);

	// -----------------------------------------------------------------------
	// Auto-advance scheduling
	// -----------------------------------------------------------------------

	/**
	 * After playing a click-group, check if the next group should auto-advance
	 * and schedule it accordingly. This chains through consecutive auto-advance
	 * groups so sequences like onClick -> afterPrevious -> afterPrevious all
	 * play without additional clicks.
	 */
	const scheduleAutoAdvanceChain = useCallback(
		(controller: PresentationAnimationController) => {
			if (!controller.shouldAutoAdvance()) {
				return;
			}

			const delay = controller.getAutoAdvanceDelay();
			const previousGroup = controller.peekNext();
			if (!previousGroup) {
				return;
			}

			const totalDelay = delay + (previousGroup.autoAdvanceDelayMs ?? 0);

			const timer = window.setTimeout(
				() => {
					const group = controller.advance();
					if (!group) {
						return;
					}

					applyAnimationGroupSteps(
						group,
						onPlayActionSound,
						setPresentationElementStates,
						presentationTimersRef,
					);
					markAnimationGroupActive(group);
					startBuildReveal(controller, group);

					// Continue the chain if more auto-advance groups follow
					scheduleAutoAdvanceChain(controller);
				},
				Math.max(0, totalDelay),
			);

			presentationTimersRef.current.push(timer);
		},
		// `scheduleAutoAdvanceChain` recursively calls itself (line 190) to walk the
		// auto-advance chain; it can't list itself as its own dependency (the const
		// isn't assigned yet when the array is evaluated). The recursive call still
		// resolves correctly because the setTimeout callback only reads the binding
		// once the outer const has been assigned.
		// oxlint-disable-next-line react/memo-dependencies -- see comment above
		[markAnimationGroupActive, onPlayActionSound, startBuildReveal],
	);

	// -----------------------------------------------------------------------
	// Slide timeline reset
	// -----------------------------------------------------------------------

	const resetSlideTimeline = useCallback(
		(slideIndex: number) => {
			cancelBuildReveal(buildRafRef);
			const slide = slides[slideIndex];
			if (!slide) {
				controllerRef.current = null;
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
		const controller = controllerRef.current;
		const activeGroup = activeAnimationGroupRef.current;
		if (
			controller &&
			controller.hasMoreSteps() &&
			shouldSeekAnimationGroup(activeGroup, activeAnimationEndAtRef.current, performance.now())
		) {
			finishDomAnimationsForGroup(activeGroup);
			const buildIds = PresentationAnimationController.collectBuildStepIds(activeGroup);
			const completedStates = controller.computeStatesFor(buildIds);
			clearPresentationTimers();
			finishAnimationGroupSteps(activeGroup, setPresentationElementStates, completedStates);
			scheduleAutoAdvanceChain(controller);
			return true;
		}
		if (!controller || !controller.hasMoreSteps()) {
			return false;
		}

		const group = controller.advance();
		if (!group) {
			return false;
		}

		applyAnimationGroupSteps(
			group,
			onPlayActionSound,
			setPresentationElementStates,
			presentationTimersRef,
		);
		markAnimationGroupActive(group);
		startBuildReveal(controller, group);

		// Schedule auto-advance for consecutive non-click groups
		scheduleAutoAdvanceChain(controller);

		return true;
	}, [
		animationsEnabled,
		clearPresentationTimers,
		markAnimationGroupActive,
		onPlayActionSound,
		scheduleAutoAdvanceChain,
		startBuildReveal,
	]);

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

			applyAnimationGroupSteps(
				group,
				onPlayActionSound,
				setPresentationElementStates,
				presentationTimersRef,
			);
			startBuildReveal(controller, group);

			return true;
		},
		[onPlayActionSound, startBuildReveal],
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

			applyAnimationGroupSteps(
				group,
				onPlayActionSound,
				setPresentationElementStates,
				presentationTimersRef,
			);
			startBuildReveal(controller, group);

			return true;
		},
		[animationsEnabled, onPlayActionSound, startBuildReveal],
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
				scheduleOpeningAutoPlayGroup(controller, {
					onPlayActionSound,
					setPresentationElementStates,
					presentationTimersRef,
					startBuildReveal,
					scheduleAutoAdvanceChain,
					markAnimationGroupActive,
				});
			}

			// Legacy preset (`slide.animations`) entrance timers.
			scheduleEntranceAnimationTimers(slide, setPresentationAnimations, presentationTimersRef);
		},
		[
			animationsEnabled,
			slides,
			onPlayActionSound,
			markAnimationGroupActive,
			scheduleAutoAdvanceChain,
			startBuildReveal,
		],
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
