import type { PptxNativeAnimation } from "../../core";
import type {
  AnimationTimeline,
  TimelineClickGroup,
  ElementAnimationState,
} from "./animation-timeline-types";
import { buildTimeline } from "./animation-timeline-builder";

// ==========================================================================
// TimelineEngine — stateful playback controller
// ==========================================================================

/**
 * Stateful engine that tracks which click-group we are on and
 * which elements should be visible/animated/hidden.
 */
export class TimelineEngine {
  private readonly timeline: AnimationTimeline;
  private currentGroupIndex: number;
  /**
   * Map of elementId → CSS animation string for all animations
   * that have been triggered so far (cumulative).
   */
  private readonly activeAnimations: Map<string, string>;
  /**
   * Set of element IDs whose entrance animation has played.
   * These elements become visible.
   */
  private readonly revealedElements: Set<string>;
  /**
   * Set of element IDs whose exit animation has played.
   * These elements become hidden after animation.
   */
  private readonly exitedElements: Set<string>;
  /**
   * Tracks the current click-group index for each interactive sequence
   * (keyed by trigger shape ID).
   */
  private readonly interactiveGroupIndexes: Map<string, number>;

  public constructor(timeline: AnimationTimeline) {
    this.timeline = timeline;
    this.currentGroupIndex = -1;
    this.activeAnimations = new Map();
    this.revealedElements = new Set();
    this.exitedElements = new Set();
    this.interactiveGroupIndexes = new Map();
  }

  /** Build a TimelineEngine from a slide's native animations. */
  public static fromAnimations(
    nativeAnimations: ReadonlyArray<PptxNativeAnimation>,
  ): TimelineEngine {
    return new TimelineEngine(buildTimeline(nativeAnimations));
  }

  /** The underlying timeline data. */
  public getTimeline(): AnimationTimeline {
    return this.timeline;
  }

  /** True if there are more click-groups to play. */
  public hasMoreSteps(): boolean {
    return this.currentGroupIndex < this.timeline.clickGroups.length - 1;
  }

  /** Total number of click-groups. */
  public get totalGroups(): number {
    return this.timeline.clickGroups.length;
  }

  /** Index of the current click-group (-1 = not started). */
  public get currentGroup(): number {
    return this.currentGroupIndex;
  }

  /**
   * Advance to the next click-group.
   * Returns the steps to animate, or `null` if no more groups remain.
   */
  public advance(): TimelineClickGroup | null {
    if (!this.hasMoreSteps()) return null;

    this.currentGroupIndex++;
    const group = this.timeline.clickGroups[this.currentGroupIndex];

    for (const step of group.steps) {
      this.activeAnimations.set(step.elementId, step.cssAnimation);

      if (step.presetClass === "entr") {
        this.revealedElements.add(step.elementId);
      }
      if (step.presetClass === "exit") {
        this.exitedElements.add(step.elementId);
      }
    }

    return group;
  }

  /**
   * Returns whether an element should be visible given the current
   * timeline state.
   *
   * - Elements without entrance animations: always visible.
   * - Elements with entrance animations: hidden until their entrance
   *   click-group has been reached.
   * - Elements with exit animations that have played: hidden.
   */
  public isElementVisible(elementId: string): boolean {
    // Exit completed → hidden
    if (this.exitedElements.has(elementId)) return false;

    // Has entrance animation but hasn't played yet → hidden
    if (
      this.timeline.entranceElementIds.has(elementId) &&
      !this.revealedElements.has(elementId)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Returns the CSS animation string for an element if one is currently
   * active, or `undefined`.
   */
  public getElementAnimation(elementId: string): string | undefined {
    return this.activeAnimations.get(elementId);
  }

  /**
   * Build a snapshot of the current animation state for all elements.
   * Returns a map: elementId → { visible, cssAnimation }.
   */
  public getElementStates(
    elementIds: ReadonlyArray<string>,
  ): Map<string, ElementAnimationState> {
    const states = new Map<string, ElementAnimationState>();
    for (const id of elementIds) {
      states.set(id, {
        visible: this.isElementVisible(id),
        cssAnimation: this.activeAnimations.get(id),
      });
    }
    return states;
  }

  /**
   * Check whether a shape ID is a trigger for an interactive sequence.
   */
  public hasInteractiveSequence(shapeId: string): boolean {
    return this.timeline.interactiveSequences.has(shapeId);
  }

  /**
   * Get all shape IDs that are interactive sequence triggers.
   */
  public getInteractiveTriggerShapeIds(): ReadonlySet<string> {
    return new Set(this.timeline.interactiveSequences.keys());
  }

  /**
   * Advance the interactive sequence for a given trigger shape.
   * Returns the click-group to play, or `null` if no more groups remain.
   */
  public advanceInteractive(triggerShapeId: string): TimelineClickGroup | null {
    const groups = this.timeline.interactiveSequences.get(triggerShapeId);
    if (!groups || groups.length === 0) return null;

    const currentIdx = this.interactiveGroupIndexes.get(triggerShapeId) ?? -1;
    const nextIdx = currentIdx + 1;

    if (nextIdx >= groups.length) return null;

    this.interactiveGroupIndexes.set(triggerShapeId, nextIdx);
    const group = groups[nextIdx];

    for (const step of group.steps) {
      this.activeAnimations.set(step.elementId, step.cssAnimation);

      if (step.presetClass === "entr") {
        this.revealedElements.add(step.elementId);
      }
      if (step.presetClass === "exit") {
        this.exitedElements.add(step.elementId);
      }
    }

    return group;
  }

  /**
   * Reset the engine to its initial state (no animations played).
   */
  public reset(): void {
    this.currentGroupIndex = -1;
    this.activeAnimations.clear();
    this.revealedElements.clear();
    this.exitedElements.clear();
    this.interactiveGroupIndexes.clear();
  }
}
