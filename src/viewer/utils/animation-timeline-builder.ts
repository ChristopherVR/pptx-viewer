import type {
  PptxNativeAnimation,
  PptxAnimationTrigger,
} from "../../core";
import { getEffectKeyframes } from "./animation";
import type {
  TimelineStep,
  TimelineClickGroup,
  AnimationTimeline,
} from "./animation-timeline-types";
import {
  resolveEffect,
  buildDynamicKeyframe,
  cssKeyframeName,
  defaultDuration,
  fillModeForClass,
  finalizeClickGroup,
} from "./animation-timeline-helpers";

// ==========================================================================
// Timeline builder
// ==========================================================================

/**
 * Build click-groups from a flat list of native animations.
 *
 * Grouping logic:
 * - An ``onClick`` animation starts a **new** click-group.
 * - A ``withPrevious`` animation is added to the **current** click-group
 *   and plays simultaneously with the previous step.
 * - An ``afterPrevious`` animation is added to the **current** click-group
 *   but delayed until the previous step completes.
 * - An ``afterDelay`` animation behaves like afterPrevious plus its
 *   triggerDelay.
 * - The very first animation implicitly starts a click-group even when
 *   its trigger is withPrevious or afterPrevious (same as PowerPoint).
 */
export function buildTimeline(
  nativeAnimations: ReadonlyArray<PptxNativeAnimation>,
): AnimationTimeline {
  if (nativeAnimations.length === 0) {
    return {
      clickGroups: [],
      entranceElementIds: new Set(),
      keyframesCss: "",
      interactiveSequences: new Map(),
    };
  }

  // Separate interactive (onShapeClick) from regular animations
  const regularAnims: PptxNativeAnimation[] = [];
  const interactiveAnims = new Map<string, PptxNativeAnimation[]>();

  for (const anim of nativeAnimations) {
    if (anim.trigger === "onShapeClick" && anim.triggerShapeId) {
      const existing = interactiveAnims.get(anim.triggerShapeId) ?? [];
      existing.push(anim);
      interactiveAnims.set(anim.triggerShapeId, existing);
    } else {
      regularAnims.push(anim);
    }
  }

  const clickGroups: TimelineClickGroup[] = [];
  const entranceIds = new Set<string>();
  const neededKeyframes = new Set<string>();
  const dynamicBlocks: string[] = [];
  let dynamicUid = 0;

  let currentGroup: TimelineStep[] = [];

  for (const anim of regularAnims) {
    const effect = resolveEffect(anim);
    const dynamic = effect
      ? undefined
      : buildDynamicKeyframe(anim, dynamicUid++);
    if (!effect && !dynamic) continue;

    const keyframe = effect ? cssKeyframeName(effect) : dynamic!.keyframeName;
    if (effect) {
      neededKeyframes.add(effect);
    }
    if (dynamic) {
      dynamicBlocks.push(dynamic.css);
    }

    const elementId = anim.targetId ?? "";
    const trigger: PptxAnimationTrigger = anim.trigger ?? "onClick";
    const duration = anim.durationMs ?? defaultDuration(anim.presetClass);
    const animDelay = anim.delayMs ?? 0;
    const triggerDelay = anim.triggerDelayMs ?? 0;
    const presetClass = anim.presetClass ?? "entr";
    const fill = fillModeForClass(anim.presetClass);

    // Compute repeat / direction
    const iterCount = anim.repeatCount ?? 1;
    const direction = anim.autoReverse ? "alternate" : "normal";

    // Track entrance elements
    if (presetClass === "entr" && elementId) {
      entranceIds.add(elementId);
    }

    // Determine whether to start a new click-group
    const isOnClick = trigger === "onClick" || trigger === "onHover";
    const isFirstAnimation =
      clickGroups.length === 0 && currentGroup.length === 0;

    if (isOnClick || isFirstAnimation) {
      // Flush current group if non-empty
      if (currentGroup.length > 0) {
        clickGroups.push(finalizeClickGroup(currentGroup));
      }
      currentGroup = [];
    }

    // Compute delay relative to start of this click-group
    let delayMs: number;
    if (trigger === "withPrevious" && currentGroup.length > 0) {
      const prev = currentGroup[currentGroup.length - 1];
      delayMs = prev.delayMs + animDelay + triggerDelay;
    } else if (
      (trigger === "afterPrevious" || trigger === "afterDelay") &&
      currentGroup.length > 0
    ) {
      const prev = currentGroup[currentGroup.length - 1];
      delayMs = prev.delayMs + prev.durationMs + animDelay + triggerDelay;
    } else {
      delayMs = animDelay + triggerDelay;
    }

    const iterStr = iterCount === Infinity ? "infinite" : String(iterCount);
    const cssAnimation = `${keyframe} ${duration}ms ease ${delayMs}ms ${iterStr} ${direction} ${fill}`;

    currentGroup.push({
      elementId,
      cssAnimation,
      keyframeName: keyframe,
      trigger,
      delayMs,
      durationMs: duration,
      fillMode: fill,
      presetClass: presetClass as TimelineStep["presetClass"],
      soundPath: anim.soundPath,
      stopSound: anim.stopSound,
    });
  }

  // Flush last group
  if (currentGroup.length > 0) {
    clickGroups.push(finalizeClickGroup(currentGroup));
  }

  // Build interactive sequence click-groups
  const interactiveSequences = buildInteractiveSequences(
    interactiveAnims,
    entranceIds,
    neededKeyframes,
    dynamicBlocks,
    dynamicUid,
  );

  // Build keyframes CSS (covers both regular and interactive animations)
  const keyframeBlocks: string[] = [];
  for (const effect of neededKeyframes) {
    const css = getEffectKeyframes(
      effect as Parameters<typeof getEffectKeyframes>[0],
    );
    if (css) keyframeBlocks.push(css);
  }
  // Append dynamic keyframes (motion paths, rotation, scale)
  keyframeBlocks.push(...dynamicBlocks);

  return {
    clickGroups,
    entranceElementIds: entranceIds,
    keyframesCss: keyframeBlocks.join("\n\n"),
    interactiveSequences,
  };
}

function buildInteractiveSequences(
  interactiveAnims: Map<string, PptxNativeAnimation[]>,
  entranceIds: Set<string>,
  neededKeyframes: Set<string>,
  dynamicBlocks: string[],
  startUid: number,
): Map<string, TimelineClickGroup[]> {
  const interactiveSequences = new Map<string, TimelineClickGroup[]>();
  let dynamicUid = startUid;

  for (const [shapeId, anims] of interactiveAnims) {
    const seqGroups: TimelineClickGroup[] = [];
    let seqGroup: TimelineStep[] = [];

    for (const anim of anims) {
      const effect = resolveEffect(anim);
      const dynamic = effect
        ? undefined
        : buildDynamicKeyframe(anim, dynamicUid++);
      if (!effect && !dynamic) continue;

      const keyframe = effect ? cssKeyframeName(effect) : dynamic!.keyframeName;
      if (effect) neededKeyframes.add(effect);
      if (dynamic) dynamicBlocks.push(dynamic.css);

      const elementId = anim.targetId ?? "";
      const seqTrigger: PptxAnimationTrigger = anim.trigger ?? "onShapeClick";
      const duration = anim.durationMs ?? defaultDuration(anim.presetClass);
      const animDelay = anim.delayMs ?? 0;
      const triggerDelay = anim.triggerDelayMs ?? 0;
      const presetClass = anim.presetClass ?? "entr";
      const fill = fillModeForClass(anim.presetClass);
      const iterCount = anim.repeatCount ?? 1;
      const direction = anim.autoReverse ? "alternate" : "normal";

      if (presetClass === "entr" && elementId) {
        entranceIds.add(elementId);
      }

      const isNewGroup = seqGroup.length === 0;
      if (isNewGroup && seqGroup.length > 0) {
        seqGroups.push(finalizeClickGroup(seqGroup));
        seqGroup = [];
      }

      let delayMs: number;
      if (seqTrigger === "withPrevious" && seqGroup.length > 0) {
        const prev = seqGroup[seqGroup.length - 1];
        delayMs = prev.delayMs + animDelay + triggerDelay;
      } else if (
        (seqTrigger === "afterPrevious" || seqTrigger === "afterDelay") &&
        seqGroup.length > 0
      ) {
        const prev = seqGroup[seqGroup.length - 1];
        delayMs = prev.delayMs + prev.durationMs + animDelay + triggerDelay;
      } else {
        delayMs = animDelay + triggerDelay;
      }

      const iterStr = iterCount === Infinity ? "infinite" : String(iterCount);
      const cssAnimation = `${keyframe} ${duration}ms ease ${delayMs}ms ${iterStr} ${direction} ${fill}`;

      seqGroup.push({
        elementId,
        cssAnimation,
        keyframeName: keyframe,
        trigger: seqTrigger,
        delayMs,
        durationMs: duration,
        fillMode: fill,
        presetClass: presetClass as TimelineStep["presetClass"],
        soundPath: anim.soundPath,
        stopSound: anim.stopSound,
      });
    }

    if (seqGroup.length > 0) {
      seqGroups.push(finalizeClickGroup(seqGroup));
    }

    if (seqGroups.length > 0) {
      interactiveSequences.set(shapeId, seqGroups);
    }
  }

  return interactiveSequences;
}
