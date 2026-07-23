import type { PptxSlide } from 'pptx-viewer-core';
import { PresentationAnimationController } from 'pptx-viewer-shared';
import { useRef, useState, useCallback, useEffect } from 'react';

import type { PresentationAnimationRuntime } from '../../types';
import type { ElementAnimationState, TimelineClickGroup } from '../../utils/animation-timeline';
import { computeEntranceAnimationDelay } from '../usePresentationSetup-helpers';
import { applyAnimationGroupSteps } from './animation-helpers';
import { driveBuildReveal, cancelBuildReveal } from './build-playback';

// ---------------------------------------------------------------------------
// Sub-hook interface
// ---------------------------------------------------------------------------

export interface UseAnimationPlaybackInput {
	slides: PptxSlide[];
	onPlayActionSound?: (soundPath: string) => void;
	/** When false, all animations are skipped (elements shown immediately). */
	showWithAnimation?: boolean;
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
	runPresentationEntranceAnimations: (slideIndex: number) => void;
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
					startBuildReveal(controller, group);

					// Continue the chain if more auto-advance groups follow
					scheduleAutoAdvanceChain(controller);
				},
				Math.max(0, totalDelay),
			);

			presentationTimersRef.current.push(timer);
		},
		[onPlayActionSound, startBuildReveal],
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
		startBuildReveal(controller, group);

		// Schedule auto-advance for consecutive non-click groups
		scheduleAutoAdvanceChain(controller);

		return true;
	}, [animationsEnabled, onPlayActionSound, scheduleAutoAdvanceChain, startBuildReveal]);

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

	const runPresentationEntranceAnimations = useCallback(
		(slideIndex: number) => {
			clearPresentationTimers();

			// When animations are disabled, skip timeline and entrance animations
			if (!animationsEnabled) {
				controllerRef.current = null;
				setPresentationAnimations([]);
				setPresentationElementStates(new Map());
				setPresentationKeyframesCss('');
				setInteractiveTriggerShapeIds(new Set());
				setHoverTriggerShapeIds(new Set());
				return;
			}

			resetSlideTimeline(slideIndex);
			const slide = slides[slideIndex];
			if (!slide) {
				setPresentationAnimations([]);
				return;
			}

			// After resetting the timeline, check if the first group should auto-play
			// (e.g. when the slide starts with withPrevious/afterPrevious animations)
			const controller = controllerRef.current;
			if (controller && controller.hasMoreSteps()) {
				const firstGroup = controller.peekNext();
				if (firstGroup && firstGroup.autoAdvance) {
					// Auto-play the first group after a brief delay
					const timer = window.setTimeout(() => {
						const group = controller.advance();
						if (group) {
							applyAnimationGroupSteps(
								group,
								onPlayActionSound,
								setPresentationElementStates,
								presentationTimersRef,
							);
							startBuildReveal(controller, group);
							scheduleAutoAdvanceChain(controller);
						}
					}, firstGroup.autoAdvanceDelayMs ?? 0);
					presentationTimersRef.current.push(timer);
				}
			}

			const entranceAnimations = [...(slide.animations || [])]
				.filter((animation) => Boolean(animation.entrance))
				.sort(
					(left, right) =>
						(left.order || Number.MAX_SAFE_INTEGER) - (right.order || Number.MAX_SAFE_INTEGER),
				);
			if (entranceAnimations.length === 0) {
				setPresentationAnimations([]);
				return;
			}

			setPresentationAnimations(
				entranceAnimations.map((animation) => ({
					elementId: animation.elementId,
					state: 'hidden',
					animation,
				})),
			);

			entranceAnimations.forEach((animation, animationIndex) => {
				const delay = computeEntranceAnimationDelay(animation.delayMs, animationIndex);
				const timer = window.setTimeout(() => {
					setPresentationAnimations((previousAnimations) =>
						previousAnimations.map((entry) =>
							entry.elementId === animation.elementId ? { ...entry, state: 'visible' } : entry,
						),
					);
				}, delay);
				presentationTimersRef.current.push(timer);
			});
		},
		[
			animationsEnabled,
			clearPresentationTimers,
			resetSlideTimeline,
			slides,
			onPlayActionSound,
			scheduleAutoAdvanceChain,
			startBuildReveal,
		],
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
		presentationTimersRef,
	};
}
