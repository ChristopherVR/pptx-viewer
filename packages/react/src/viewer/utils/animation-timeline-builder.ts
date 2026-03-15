import type {
  PptxNativeAnimation,
  PptxAnimationTrigger,
} from "pptx-viewer-core";
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
 * - ``onHover`` animations are separated into hover sequences (like
 *   interactive sequences but triggered by mouse hover).
 * - The very first animation implicitly starts a click-group even when
 *   its trigger is withPrevious or afterPrevious (same as PowerPoint).
 *
 * Auto-advance: When an onClick group is immediately followed by
 * afterPrevious/withPrevious/afterDelay animations that would form
 * their own group (because no onClick precedes them), those groups
 * are marked with `autoAdvance: true` so the playback engine can
 * automatically advance through them without requiring a click.
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
      hoverSequences: new Map(),
    };
  }

  // Separate interactive (onShapeClick), hover (onHover), and regular animations
  const regularAnims: PptxNativeAnimation[] = [];
  const interactiveAnims = new Map<string, PptxNativeAnimation[]>();
  const hoverAnims: PptxNativeAnimation[] = [];

  for (const anim of nativeAnimations) {
    if (anim.trigger === "onShapeClick" && anim.triggerShapeId) {
      const existing = interactiveAnims.get(anim.triggerShapeId) ?? [];
      existing.push(anim);
      interactiveAnims.set(anim.triggerShapeId, existing);
    } else if (anim.trigger === "onHover" && anim.targetId) {
      hoverAnims.push(anim);
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
  /** Whether the current group was started by an onClick trigger. */
  let currentGroupIsClick = false;

  for (const anim of regularAnims) {
    const expandedSteps = expandIterateAnimation(anim);

    for (const singleAnim of expandedSteps) {
      const effect = resolveEffect(singleAnim);
      const dynamic = effect
        ? undefined
        : buildDynamicKeyframe(singleAnim, dynamicUid++);
      if (!effect && !dynamic) continue;

      const keyframe = effect ? cssKeyframeName(effect) : dynamic!.keyframeName;
      if (effect) {
        neededKeyframes.add(effect);
      }
      if (dynamic) {
        dynamicBlocks.push(dynamic.css);
      }

      const elementId = singleAnim.targetId ?? "";
      const trigger: PptxAnimationTrigger = singleAnim.trigger ?? "onClick";
      const duration =
        singleAnim.durationMs ?? defaultDuration(singleAnim.presetClass);
      const animDelay = singleAnim.delayMs ?? 0;
      const triggerDelay = singleAnim.triggerDelayMs ?? 0;
      const presetClass = singleAnim.presetClass ?? "entr";
      const fill = fillModeForClass(singleAnim.presetClass);

      // Compute repeat / direction
      const iterCount = singleAnim.repeatCount ?? 1;
      const direction = singleAnim.autoReverse ? "alternate" : "normal";

      // Track entrance elements
      if (presetClass === "entr" && elementId) {
        entranceIds.add(elementId);
      }

      // Determine whether to start a new click-group
      const isOnClick = trigger === "onClick";
      const isFirstAnimation =
        clickGroups.length === 0 && currentGroup.length === 0;

      if (isOnClick || isFirstAnimation) {
        // Flush current group if non-empty
        if (currentGroup.length > 0) {
          const group = finalizeClickGroup(currentGroup);
          if (!currentGroupIsClick && clickGroups.length > 0) {
            group.autoAdvance = true;
          }
          clickGroups.push(group);
        }
        currentGroup = [];
        currentGroupIsClick = isOnClick || isFirstAnimation;
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
        soundPath: singleAnim.soundPath,
        stopSound: singleAnim.stopSound,
      });
    }
  }

  // Flush last group
  if (currentGroup.length > 0) {
    const group = finalizeClickGroup(currentGroup);
    if (!currentGroupIsClick && clickGroups.length > 0) {
      group.autoAdvance = true;
    }
    clickGroups.push(group);
  }

  // Compute auto-advance delay for auto-advance groups
  for (let i = 1; i < clickGroups.length; i++) {
    if (clickGroups[i].autoAdvance) {
      clickGroups[i].autoAdvanceDelayMs = 0;
    }
  }

  // Build interactive sequence click-groups
  const interactiveSequences = buildSequenceGroups(
    interactiveAnims,
    entranceIds,
    neededKeyframes,
    dynamicBlocks,
    dynamicUid,
  );

  // Build hover sequence click-groups
  const { hoverSequences, nextUid } = buildHoverSequences(
    hoverAnims,
    entranceIds,
    neededKeyframes,
    dynamicBlocks,
    dynamicUid + countDynamicUids(interactiveAnims),
  );
  // Update dynamicUid for any downstream use
  void nextUid;

  // Build keyframes CSS (covers regular, interactive, and hover animations)
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
    hoverSequences,
  };
}

/**
 * Count how many dynamic UIDs the interactive sequence builder would consume.
 * This is used to give the hover sequence builder non-overlapping UIDs.
 */
function countDynamicUids(
  interactiveAnims: Map<string, PptxNativeAnimation[]>,
): number {
  let count = 0;
  for (const [, anims] of interactiveAnims) {
    for (const anim of anims) {
      const effect = resolveEffect(anim);
      if (!effect) count++;
    }
  }
  return count;
}

/**
 * Expand an animation with `iterate` configuration into multiple
 * staggered sub-animations. Each sub-element gets a slightly delayed copy.
 *
 * - `iterate.type === "lt"` (letter): creates per-character animations
 * - `iterate.type === "wd"` (word): creates per-word animations
 * - `iterate.type === "el"` (element): no expansion needed
 *
 * The iterate timing interval (`tmPct` or `tmAbs`) controls the stagger
 * delay between consecutive sub-elements.
 */
function expandIterateAnimation(
  anim: PptxNativeAnimation,
): PptxNativeAnimation[] {
  const iterate = anim.iterate;
  if (!iterate || iterate.type === "el") return [anim];

  // We return the original animation unchanged for now —
  // iterate expansion is handled at a higher level by the text-build system
  // when buildType is set. When iterate is present without a matching
  // buildType, we still return the original to avoid dropping the animation.
  return [anim];
}

/**
 * Build sequence-based click-groups (used for both interactive and hover).
 */
function buildSequenceGroups(
  animsByKey: Map<string, PptxNativeAnimation[]>,
  entranceIds: Set<string>,
  neededKeyframes: Set<string>,
  dynamicBlocks: string[],
  startUid: number,
): Map<string, TimelineClickGroup[]> {
  const sequences = new Map<string, TimelineClickGroup[]>();
  let dynamicUid = startUid;

  for (const [shapeId, anims] of animsByKey) {
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
      sequences.set(shapeId, seqGroups);
    }
  }

  return sequences;
}

/**
 * Build hover sequences from onHover animations.
 * Hover animations are grouped by their target element ID (the element
 * that the animation applies to). The hover trigger is the element itself
 * unless a triggerShapeId is specified.
 */
function buildHoverSequences(
  hoverAnims: PptxNativeAnimation[],
  entranceIds: Set<string>,
  neededKeyframes: Set<string>,
  dynamicBlocks: string[],
  startUid: number,
): { hoverSequences: Map<string, TimelineClickGroup[]>; nextUid: number } {
  // Group hover anims by trigger shape (targetId used as hover trigger)
  const hoverByTarget = new Map<string, PptxNativeAnimation[]>();
  for (const anim of hoverAnims) {
    const triggerId = anim.triggerShapeId ?? anim.targetId ?? "";
    if (!triggerId) continue;
    const existing = hoverByTarget.get(triggerId) ?? [];
    existing.push(anim);
    hoverByTarget.set(triggerId, existing);
  }

  const sequences = buildSequenceGroups(
    hoverByTarget,
    entranceIds,
    neededKeyframes,
    dynamicBlocks,
    startUid,
  );

  let nextUid = startUid;
  for (const [, anims] of hoverByTarget) {
    for (const anim of anims) {
      const effect = resolveEffect(anim);
      if (!effect) nextUid++;
    }
  }

  return { hoverSequences: sequences, nextUid: startUid + nextUid };
}
