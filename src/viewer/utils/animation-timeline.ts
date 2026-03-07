/**
 * Animation Timeline Engine — GAP-04
 *
 * Barrel re-export. Implementation split into:
 *   - animation-timeline-types.ts    (interfaces)
 *   - animation-timeline-text-build.ts (text-build expansion)
 *   - animation-timeline-builder.ts  (timeline construction)
 *   - animation-timeline-engine.ts   (stateful playback)
 */

export type {
  TimelineStep,
  TimelineClickGroup,
  AnimationTimeline,
  ElementAnimationState,
} from "./animation-timeline-types";

export type { TextBuildSegmentCounts } from "./animation-timeline-text-build";
export {
  countTextSegments,
  TEXT_BUILD_ID_SEP,
  expandTextBuildAnimations,
} from "./animation-timeline-text-build";

export { buildTimeline } from "./animation-timeline-builder";

export { TimelineEngine } from "./animation-timeline-engine";
