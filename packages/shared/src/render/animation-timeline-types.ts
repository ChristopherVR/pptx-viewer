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
// Staged-build reveal descriptors (p:bldChart / p:bldDgm)
// ==========================================================================

/**
 * Normalized staged-reveal mode for a chart graphic frame, derived from the
 * OOXML `a:bldChart/@bld` (or `p:bldOleChart/@bld`) token:
 *  - `asOne`      the whole chart appears at once (`allAtOnce`).
 *  - `bySeries`   one data series is revealed per stage (`series`).
 *  - `byCategory` one category is revealed per stage (`category`).
 *  - `byElement`  one series/category ELEMENT is revealed per stage
 *                 (`seriesElement` / `categoryElement`).
 */
export type ChartBuildMode = 'asOne' | 'bySeries' | 'byCategory' | 'byElement';

/**
 * Normalized staged-reveal mode for a SmartArt diagram, derived from the OOXML
 * `a:bldDgm/@bld` or `p:bldDgm/@bld` token:
 *  - `asOne`        the whole diagram appears at once (`whole` / `allAtOnce`).
 *  - `byOne`        one node is revealed per stage (`one`, and the assorted
 *                   `depthBy*` / `breadthBy*` / directional traversals).
 *  - `byLvl`        levels are revealed one element at a time (`lvlOne`).
 *  - `byLvlAtOnce`  a whole level is revealed per stage (`lvlAtOnce`).
 */
export type DiagramBuildMode = 'asOne' | 'byOne' | 'byLvl' | 'byLvlAtOnce';

/**
 * Static staged-build descriptor attached to a {@link TimelineStep}. Carries
 * only the graphic KIND + normalized MODE; the per-tick reveal fraction is
 * computed separately (see {@link ElementBuildState.progress}) because it is a
 * function of playback time, not of the parsed animation.
 */
export type StepBuildDescriptor =
	| { kind: 'chart'; mode: ChartBuildMode }
	| { kind: 'diagram'; mode: DiagramBuildMode };

/**
 * Playback-time staged-build state surfaced on {@link ElementAnimationState}.
 * `progress` is the 0..1 fraction of the build revealed at the current playback
 * time; a consumer maps it to its own item COUNT (see `revealedStageCount`).
 */
export type ElementBuildState =
	| { kind: 'chart'; mode: ChartBuildMode; progress: number }
	| { kind: 'diagram'; mode: DiagramBuildMode; progress: number };

/** Which shape paint property an active `p:animClr` color animation targets. */
export type ColorAnimationTarget = 'fill' | 'stroke';

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

/**
 * A media playback command carried by a timeline step, parsed from an OOXML
 * `p:cmd` node in the timing tree. Unlike a visual animation step, a command
 * step applies no CSS: it instructs the playback layer to drive a media element
 * (play/pause/seek) when the step fires. The command participates in click-group
 * sequencing exactly like a visual step so it triggers at the correct time.
 */
export interface TimelineStepCommand {
	/** OOXML `p:cmd/@type` verb family: `call`, `evt`, or `verb`. */
	type?: string;
	/** OOXML `p:cmd/@cmd` string, e.g. `playFrom(0.0)`, `pause`, `play`, `stop`. */
	command: string;
	/** Target element/shape id the command acts on (from `p:tgtEl`). */
	targetId: string;
}

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
	/**
	 * Media playback command from a `p:cmd` timing node. When present, this step
	 * carries no visual animation (`elementId` is empty and `cssAnimation` is a
	 * blank string); the playback layer acts on the referenced media element
	 * instead. See {@link TimelineStepCommand}.
	 */
	command?: TimelineStepCommand;
	/**
	 * Staged-build descriptor when this step reveals a chart / SmartArt diagram
	 * in stages (`p:bldChart` / `p:bldDgm`) rather than as one whole element.
	 * Present alongside the normal `cssAnimation` (the wrapper still fades in);
	 * a staged-reveal renderer additionally reads the descriptor + the step's
	 * {@link delayMs}/{@link durationMs} to compute how much is revealed over
	 * time. Absent for ordinary whole-element entrances.
	 */
	build?: StepBuildDescriptor;
	/**
	 * Shape paint targets of an active `p:animClr` color animation on this step,
	 * if any. Lets a vector renderer set `fill: inherit` / `stroke: inherit` on
	 * the painted path so the wrapper-level colour keyframes cascade through.
	 */
	colorTargets?: readonly ColorAnimationTarget[];
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
	/**
	 * Staged-build reveal state, present only when the active animation builds a
	 * chart or SmartArt diagram in stages (`p:bldChart` / `p:bldDgm`) rather than
	 * revealing the whole element at once. A staged renderer multiplies
	 * `build.progress` (0..1) by its own series / category / level COUNT to
	 * decide how many stages are revealed at the current playback time; see
	 * {@link import('./animation-build').revealedStageCount}. Absent for ordinary
	 * whole-element entrances, so existing renderers are unaffected.
	 */
	build?: ElementBuildState;
	/**
	 * True when an active `p:animClr` color animation targets this shape's fill.
	 * A vector renderer should then paint the fill with `fill: inherit` so the
	 * wrapper-level colour keyframes cascade to the SVG path. Absent/false means
	 * no active fill-colour animation.
	 */
	animatesFill?: boolean;
	/**
	 * True when an active `p:animClr` color animation targets this shape's
	 * stroke. A vector renderer should then paint the stroke with
	 * `stroke: inherit`. Absent/false means no active stroke-colour animation.
	 */
	animatesStroke?: boolean;
}

/**
 * Neutral CSS-properties shape returned by initial-style helpers. Bindings that
 * use a framework-specific style type (e.g. React's `CSSProperties`) cast this
 * at the boundary. Keys are camelCase to match inline-style objects.
 */
export type AnimationStyle = Record<string, string | number>;
