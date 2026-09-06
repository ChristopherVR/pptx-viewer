/**
 * `animation-timeline-types` - pure interfaces for the native-animation
 * (OOXML `p:timing` tree) playback engine shared by every binding.
 *
 * These describe the *parsed* native animation model (`PptxNativeAnimation`,
 * driven by `presetClass` / `presetId`), as opposed to the editor-level
 * {@link import('./animation-css').AnimationCssResult} model in `animation-css`
 * (driven by `PptxElementAnimation` preset strings). Both coexist in shared.
 *
 * This module is a pure re-export barrel: the actual type groups live in
 * sibling files (split out to keep each file under the repo's file-size
 * limit). Import from here as before; nothing about the public surface
 * changed.
 *
 * @module render/animation-timeline-types
 */

export type { EffectName } from './animation-timeline-effect-names';
export type {
	ChartBuildMode,
	DiagramBuildMode,
	StepBuildDescriptor,
	TimelineStepGraphicElement,
	ChartRevealPoint,
	ChartRevealDescriptor,
	DiagramRevealDescriptor,
	ElementBuildState,
	ColorAnimationTarget,
} from './animation-timeline-build-descriptors';
export type { AnimationStep, TimelineStepCommand, TimelineStep } from './animation-timeline-step';
export type {
	TimelineClickGroup,
	AnimationTimeline,
	ElementAnimationState,
	AnimationStyle,
} from './animation-timeline-group';
