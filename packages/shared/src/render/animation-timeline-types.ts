/**
 * `animation-timeline-types` — pure interfaces for the native-animation
 * (OOXML `p:timing` tree) playback engine shared by every binding.
 *
 * These describe the *parsed* native animation model (`PptxNativeAnimation`,
 * driven by `presetClass` / `presetId`), as opposed to the editor-level
 * {@link import('./animation-css').AnimationCssResult} model in `animation-css`
 * (driven by `PptxElementAnimation` preset strings). Both coexist in shared.
 *
 * @module render/animation-timeline-types
 */

import type { PptxAnimationTrigger } from 'pptx-viewer-core';

// ==========================================================================
// Effect name type (catalog of CSS keyframe short-names)
// ==========================================================================

/** Catalog of static effect keyframe short-names (without the `pptx-` prefix). */
export type EffectName =
	| 'appear'
	| 'fadeIn'
	| 'flyInLeft'
	| 'flyInRight'
	| 'flyInTop'
	| 'flyInBottom'
	| 'zoomIn'
	| 'bounceIn'
	| 'wipeIn'
	| 'splitIn'
	| 'dissolveIn'
	| 'wheelIn'
	| 'blindsIn'
	| 'boxIn'
	| 'floatIn'
	| 'riseUp'
	| 'swivel'
	| 'expandIn'
	| 'checkerboardIn'
	| 'flashIn'
	| 'peekIn'
	| 'randomBarsIn'
	| 'spinnerIn'
	| 'growTurnIn'
	| 'disappear'
	| 'fadeOut'
	| 'flyOutLeft'
	| 'flyOutRight'
	| 'flyOutTop'
	| 'flyOutBottom'
	| 'zoomOut'
	| 'bounceOut'
	| 'wipeOut'
	| 'shrinkOut'
	| 'dissolveOut'
	| 'pulse'
	| 'spin'
	| 'teeter'
	| 'growShrink'
	| 'transparency'
	| 'boldFlash'
	| 'wave'
	| 'colorWave'
	| 'bounce'
	| 'flash';

// ==========================================================================
// Simple sequenced animation step (AnimationSequencer model)
// ==========================================================================

/** A single sequenced animation step used by the flat-sequence builder. */
export interface AnimationStep {
	elementId: string;
	trigger: PptxAnimationTrigger;
	delayMs: number;
	durationMs: number;
	cssKeyframes: string;
	cssAnimation: string;
	fillMode: 'forwards' | 'backwards' | 'both';
}

// ==========================================================================
// Click-group timeline model (TimelineEngine)
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
	fillMode: 'forwards' | 'backwards' | 'both';
	/** Preset class for determining visibility semantics. */
	presetClass: 'entr' | 'exit' | 'emph' | 'path';
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
	/**
	 * Whether this group should auto-advance (play automatically without a click).
	 * True when the group consists entirely of afterPrevious/withPrevious/afterDelay
	 * animations that were folded into the previous click-group's timeline.
	 */
	autoAdvance?: boolean;
	/**
	 * Delay in ms before auto-advancing to this group (relative to
	 * the end of the preceding group). Only meaningful when `autoAdvance` is true.
	 */
	autoAdvanceDelayMs?: number;
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
	/**
	 * Hover sequences keyed by trigger shape ID.
	 * When a shape is hovered over, its click-groups play.
	 * Supports both onMouseOver (start) and onMouseOut (reverse/stop).
	 */
	hoverSequences: ReadonlyMap<string, TimelineClickGroup[]>;
}

/** Snapshot of a single element's animation state at a point in the timeline. */
export interface ElementAnimationState {
	/** Whether the element should be visible. */
	visible: boolean;
	/** CSS animation shorthand to apply (undefined = no active animation). */
	cssAnimation: string | undefined;
}

/**
 * Neutral CSS-properties shape returned by initial-style helpers. Bindings that
 * use a framework-specific style type (e.g. React's `CSSProperties`) cast this
 * at the boundary. Keys are camelCase to match inline-style objects.
 */
export type AnimationStyle = Record<string, string | number>;
