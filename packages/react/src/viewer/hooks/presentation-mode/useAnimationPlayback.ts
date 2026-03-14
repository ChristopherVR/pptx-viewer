import { useRef, useState, useCallback } from "react";

import { type PptxSlide, hasTextProperties } from "pptx-viewer-core";
import type { PresentationAnimationRuntime } from "../../types";
import {
  TimelineEngine,
  type ElementAnimationState,
  expandTextBuildAnimations,
  countTextSegments,
  type TextBuildSegmentCounts,
  TEXT_BUILD_ID_SEP,
} from "../../utils/animation-timeline";
import { applyAnimationGroupSteps } from "./animation-helpers";
import { computeEntranceAnimationDelay } from "../usePresentationSetup-helpers";

// ---------------------------------------------------------------------------
// Sub-hook interface
// ---------------------------------------------------------------------------

export interface UseAnimationPlaybackInput {
  slides: PptxSlide[];
  onPlayActionSound?: (soundPath: string) => void;
}

export interface UseAnimationPlaybackResult {
  presentationAnimations: PresentationAnimationRuntime[];
  presentationElementStates: Map<string, ElementAnimationState>;
  presentationKeyframesCss: string;
  interactiveTriggerShapeIds: ReadonlySet<string>;
  clearPresentationTimers: () => void;
  playNextAnimationGroup: () => boolean;
  handleInteractiveShapeClick: (shapeId: string) => boolean;
  runPresentationEntranceAnimations: (slideIndex: number) => void;
  /** Exposed so the orchestrator can schedule additional timers (e.g. auto-advance). */
  presentationTimersRef: React.RefObject<number[]>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnimationPlayback(
  input: UseAnimationPlaybackInput,
): UseAnimationPlaybackResult {
  const { slides, onPlayActionSound } = input;

  // State
  const [presentationAnimations, setPresentationAnimations] = useState<
    PresentationAnimationRuntime[]
  >([]);
  const [presentationElementStates, setPresentationElementStates] = useState<
    Map<string, ElementAnimationState>
  >(new Map());
  const [presentationKeyframesCss, setPresentationKeyframesCss] = useState("");
  const [interactiveTriggerShapeIds, setInteractiveTriggerShapeIds] = useState<
    ReadonlySet<string>
  >(new Set());

  // Refs
  const presentationTimersRef = useRef<number[]>([]);
  const timelineEngineRef = useRef<TimelineEngine | null>(null);

  // -----------------------------------------------------------------------
  // Timer management
  // -----------------------------------------------------------------------

  const clearPresentationTimers = useCallback(() => {
    presentationTimersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
    });
    presentationTimersRef.current = [];
  }, []);

  // -----------------------------------------------------------------------
  // Slide timeline reset
  // -----------------------------------------------------------------------

  const resetSlideTimeline = useCallback(
    (slideIndex: number) => {
      const slide = slides[slideIndex];
      if (!slide) {
        timelineEngineRef.current = null;
        setPresentationElementStates(new Map());
        setPresentationKeyframesCss("");
        setInteractiveTriggerShapeIds(new Set());
        return;
      }

      // Build segment counts for elements that have text-build animations
      const nativeAnims = slide.nativeAnimations ?? [];
      const segmentCounts = new Map<string, TextBuildSegmentCounts>();
      for (const anim of nativeAnims) {
        if (anim.buildType && anim.buildType !== "allAtOnce" && anim.targetId) {
          const el = slide.elements.find((e) => e.id === anim.targetId);
          if (
            el &&
            hasTextProperties(el) &&
            el.textSegments &&
            el.textSegments.length > 0
          ) {
            segmentCounts.set(
              anim.targetId,
              countTextSegments(el.textSegments),
            );
          }
        }
      }

      // Expand text-build animations into sub-element animations
      const expandedAnims =
        segmentCounts.size > 0
          ? expandTextBuildAnimations(nativeAnims, segmentCounts)
          : nativeAnims;

      const engine = TimelineEngine.fromAnimations(expandedAnims);
      timelineEngineRef.current = engine;
      setPresentationKeyframesCss(engine.getTimeline().keyframesCss);

      // Expose interactive trigger shape IDs for cursor styling
      setInteractiveTriggerShapeIds(engine.getInteractiveTriggerShapeIds());

      // Collect both element IDs and sub-element IDs for state tracking
      const allIds: string[] = slide.elements.map((element) => element.id);
      for (const anim of expandedAnims) {
        if (anim.targetId && anim.targetId.includes(TEXT_BUILD_ID_SEP)) {
          allIds.push(anim.targetId);
        }
      }
      setPresentationElementStates(engine.getElementStates(allIds));
    },
    [slides],
  );

  // -----------------------------------------------------------------------
  // Main timeline animation advance
  // -----------------------------------------------------------------------

  const playNextAnimationGroup = useCallback((): boolean => {
    const engine = timelineEngineRef.current;
    if (!engine || !engine.hasMoreSteps()) return false;

    const group = engine.advance();
    if (!group) return false;

    applyAnimationGroupSteps(
      group,
      onPlayActionSound,
      setPresentationElementStates,
      presentationTimersRef,
    );

    return true;
  }, [onPlayActionSound]);

  // -----------------------------------------------------------------------
  // Interactive shape-click animation
  // -----------------------------------------------------------------------

  const handleInteractiveShapeClick = useCallback(
    (shapeId: string): boolean => {
      const engine = timelineEngineRef.current;
      if (!engine || !engine.hasInteractiveSequence(shapeId)) return false;

      const group = engine.advanceInteractive(shapeId);
      if (!group) return false;

      applyAnimationGroupSteps(
        group,
        onPlayActionSound,
        setPresentationElementStates,
        presentationTimersRef,
      );

      return true;
    },
    [onPlayActionSound],
  );

  // -----------------------------------------------------------------------
  // Entrance animations (legacy animation[] array on a slide)
  // -----------------------------------------------------------------------

  const runPresentationEntranceAnimations = useCallback(
    (slideIndex: number) => {
      clearPresentationTimers();
      resetSlideTimeline(slideIndex);
      const slide = slides[slideIndex];
      if (!slide) {
        setPresentationAnimations([]);
        return;
      }

      const entranceAnimations = [...(slide.animations || [])]
        .filter((animation) => Boolean(animation.entrance))
        .sort(
          (left, right) =>
            (left.order || Number.MAX_SAFE_INTEGER) -
            (right.order || Number.MAX_SAFE_INTEGER),
        );
      if (entranceAnimations.length === 0) {
        setPresentationAnimations([]);
        return;
      }

      setPresentationAnimations(
        entranceAnimations.map((animation) => ({
          elementId: animation.elementId,
          state: "hidden",
          animation,
        })),
      );

      entranceAnimations.forEach((animation, animationIndex) => {
        const delay = computeEntranceAnimationDelay(animation.delayMs, animationIndex);
        const timer = window.setTimeout(() => {
          setPresentationAnimations((previousAnimations) =>
            previousAnimations.map((entry) =>
              entry.elementId === animation.elementId
                ? { ...entry, state: "visible" }
                : entry,
            ),
          );
        }, delay);
        presentationTimersRef.current.push(timer);
      });
    },
    [clearPresentationTimers, resetSlideTimeline, slides],
  );

  return {
    presentationAnimations,
    presentationElementStates,
    presentationKeyframesCss,
    interactiveTriggerShapeIds,
    clearPresentationTimers,
    playNextAnimationGroup,
    handleInteractiveShapeClick,
    runPresentationEntranceAnimations,
    presentationTimersRef,
  };
}
