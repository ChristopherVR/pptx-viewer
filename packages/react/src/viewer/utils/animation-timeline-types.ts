import type { PptxAnimationTrigger } from "pptx-viewer-core";

// ==========================================================================
// Public interfaces for the animation timeline engine
// ==========================================================================

/** A single animation applied to one element within a click-group. */
export interface TimelineStep {
  /** Target element ID. */
  elementId: string;
  /** CSS animation shorthand to apply (e.g. "pptx-fadeIn 500ms ease 0ms 1 both"). */
  cssAnimation: string;
  /** Name of the CSS @keyframes rule (e.g. "pptx-fadeIn"). */
  keyframeName: string;
  /** Trigger that produced this step. */
  trigger: PptxAnimationTrigger;
  /** Delay in ms relative to the start of the click-group. */
  delayMs: number;
  /** Duration in ms of the animation. */
  durationMs: number;
  /** CSS animation fill mode. */
  fillMode: "forwards" | "backwards" | "both";
  /** Preset class for determining visibility semantics. */
  presetClass: "entr" | "exit" | "emph" | "path";
  /** Resolved sound file path to play when this step triggers. */
  soundPath?: string;
  /** Whether to stop any currently playing animation sound. */
  stopSound?: boolean;
}

/** A group of animation steps that play on a single click/advance action. */
export interface TimelineClickGroup {
  /** Steps that play when this group triggers. */
  steps: TimelineStep[];
  /**
   * Total duration (ms) from first step start to last step end
   * within this click-group.
   */
  totalDurationMs: number;
}

/** The full animation timeline for a slide. */
export interface AnimationTimeline {
  /** Ordered list of click-groups. Each click advances to the next group. */
  clickGroups: TimelineClickGroup[];
  /** Set of element IDs that have entrance animations (initially hidden). */
  entranceElementIds: ReadonlySet<string>;
  /** All CSS @keyframes definitions needed by this timeline. */
  keyframesCss: string;
  /**
   * Interactive sequences keyed by trigger shape ID.
   * When a shape is clicked, its click-groups play independently of the main timeline.
   */
  interactiveSequences: ReadonlyMap<string, TimelineClickGroup[]>;
}

// ==========================================================================
// Snapshot type for element animation state
// ==========================================================================

export interface ElementAnimationState {
  /** Whether the element should be visible. */
  visible: boolean;
  /** CSS animation shorthand to apply (undefined = no active animation). */
  cssAnimation: string | undefined;
}
