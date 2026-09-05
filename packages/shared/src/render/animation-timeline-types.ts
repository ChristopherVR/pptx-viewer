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

import type { AnimationConditionEvent, PptxAnimationTrigger } from 'pptx-viewer-core';

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
	| 'circleIn'
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
	| 'diamondIn'
	| 'plusIn'
	| 'wedgeIn'
	| 'cutIn'
	| 'stretchInLeft'
	| 'stretchInRight'
	| 'stretchInTop'
	| 'stretchInBottom'
	| 'newsflashIn'
	| 'disappear'
	| 'fadeOut'
	| 'flyOutLeft'
	| 'flyOutRight'
	| 'flyOutTop'
	| 'flyOutBottom'
	| 'zoomOut'
	| 'bounceOut'
	| 'sinkDown'
	| 'wipeOut'
	| 'shrinkOut'
	| 'dissolveOut'
	| 'cutOut'
	| 'stretchOutLeft'
	| 'stretchOutRight'
	| 'stretchOutTop'
	| 'stretchOutBottom'
	| 'newsflashOut'
	| 'boxOut'
	| 'checkerboardOut'
	| 'blindsOut'
	| 'wheelOut'
	| 'randomBarsOut'
	| 'diamondOut'
	| 'plusOut'
	| 'wedgeOut'
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
 *
 * The chart variant's `animateBackground` mirrors `a:bldChart/@animBg`
 * (default `true`): whether the chart's background/axes/gridlines/legend
 * arrive WITH the first revealed stage (`true`, the default) or are shown
 * throughout regardless of build progress (`false`). See
 * `chart-reveal-descriptor`'s `resolveChartRevealDescriptor`.
 */
export type StepBuildDescriptor =
	| { kind: 'chart'; mode: ChartBuildMode; animateBackground?: boolean }
	| { kind: 'diagram'; mode: DiagramBuildMode };

/**
 * `p:spTgt/p:graphicEl` (CT_TLGraphicalObjectBuildElement, ECMA-376 S19.5.34)
 * index data carried by a {@link TimelineStep}'s source animation target, when
 * a deck authors one effect per chart series/category/element instead of a
 * single `p:bldGraphic` staged reveal. Only `seriesIdx` set means "whole
 * series"; only `categoryIdx` set means "whole category"; both set means a
 * single (series, category) cell. See `chart-reveal-descriptor`.
 */
export interface TimelineStepGraphicElement {
	seriesIdx?: number;
	categoryIdx?: number;
	bldStep?: string;
}

/**
 * One authored `p:graphicEl` reveal unit resolved onto a chart, per
 * `TimelineStepGraphicElement`'s "both indices set" case: a single (series,
 * category) cell revealed by a `bldStep="seriesEl"`/`"categoryEl"` effect.
 */
export interface ChartRevealPoint {
	seriesIdx: number;
	categoryIdx: number;
}

/**
 * Playback-time chart reveal state derived from AUTHORED `p:graphicEl`
 * indices (see `chart-reveal-descriptor`'s `resolveChartRevealDescriptor`),
 * rather than from click-count/time progress. Present on
 * {@link ElementAnimationState.chartReveal} only when every fired
 * chart-build step for the element carried index data; a renderer prefers
 * this over the progress-based `build`/`ElementBuildState` path when present,
 * since it reflects the real authored reveal set (correct even for a
 * reversed-order or gapped chart build), and falls back to `build` when
 * absent.
 */
export interface ChartRevealDescriptor {
	/**
	 * Whether the chart's background/axes/gridlines/legend should currently be
	 * visible: always `true` when the chart's `animateBackground` is `false`
	 * ("shown throughout"), otherwise `true` from the first revealed stage
	 * onward.
	 */
	background: boolean;
	/** Whole series revealed by a `bldStep="series"` effect. */
	series: ReadonlySet<number>;
	/** Whole categories revealed by a `bldStep="category"` effect. */
	categories: ReadonlySet<number>;
	/** Individual cells revealed by a `bldStep="seriesEl"`/`"categoryEl"` effect. */
	points: readonly ChartRevealPoint[];
}

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
	 * `p:spTgt/p:graphicEl` index data from this step's source animation
	 * target, when present (a per-series/per-category chart or diagram build
	 * effect). See {@link TimelineStepGraphicElement} and
	 * `chart-reveal-descriptor`.
	 */
	graphicElement?: TimelineStepGraphicElement;
	/**
	 * Shape paint targets of an active `p:animClr` color animation on this step,
	 * if any. Lets a vector renderer set `fill: inherit` / `stroke: inherit` on
	 * the painted path so the wrapper-level colour keyframes cascade through.
	 */
	colorTargets?: readonly ColorAnimationTarget[];
	/**
	 * True when the playback layer must keep this step's CSS animation attached
	 * after it finishes rather than clearing it on cleanup, so the effect's
	 * final frame persists (OOXML `p:cTn/@fill="hold"` or `"freeze"`).
	 *
	 * Only meaningful for `emph` / `path` steps: an `entr` step's held state is
	 * already its resting (un-animated) style, so clearing is harmless there,
	 * and `exit` visibility is governed separately by `presetClass`. Without
	 * this, an emphasis colour/scale change or a motion path's final position
	 * snapped back to the pre-effect style a few ms after every effect
	 * finished, because clearing the CSS `animation` shorthand drops its
	 * `fill-mode` along with it.
	 */
	holdEndState?: boolean;
	/**
	 * True when `afterAnimation: "hideAfterAnimation"` applies to this step:
	 * the element should hide once the effect's active window ends, even
	 * though the effect itself is an entrance or emphasis (which otherwise
	 * leave the element visible). See `animation-after-effect` in
	 * `pptx-viewer-shared`.
	 */
	hideAfterEffect?: boolean;
	/**
	 * True when `afterAnimation: "hideOnNextClick"` applies to this step.
	 * `injectHideOnNextClickSteps` consumes this during timeline construction
	 * to splice a synthetic hide step into the following click-group; it is
	 * left on the original step afterward purely as informational metadata.
	 */
	pendingHideOnNextClick?: boolean;
	/**
	 * Restart behaviour from `p:cTn/@restart` (ST_TLTimeNodeRestartType,
	 * ECMA-376 S19.5.27), forwarded from the source `PptxNativeAnimation`.
	 * `TimelineEngine` reads this to decide whether a re-trigger of this same
	 * step (an interactive/hover sequence replayed, or a slide reset) is
	 * allowed while the step's previous run is still active, or at all.
	 * Absent means the OOXML default (`always`: no restriction).
	 */
	restart?: 'always' | 'whenNotActive' | 'never';
	/**
	 * `p:seq/@concurrent` of the innermost enclosing sequence, if any (ECMA-376
	 * S19.5.60), forwarded from the source `PptxNativeAnimation`. Rolled up
	 * onto the owning {@link TimelineClickGroup} by `finalizeClickGroup`; see
	 * that type's own field for the playback meaning.
	 */
	seqConcurrent?: boolean;
	/** `p:seq/@nextAc` of the innermost enclosing sequence, if any. */
	seqNextAction?: 'none' | 'seek';
	/** `p:seq/@prevAc` of the innermost enclosing sequence, if any. */
	seqPrevAction?: 'none' | 'skipTimeNode';
	/**
	 * Id of the `p:excl` container this step's effect belongs to, when it is
	 * inside one (ECMA-376 S19.5.24 CT_TLExclusiveTimeNode: at most one direct
	 * child of an exclusive container plays at a time). {@link TimelineEngine}
	 * uses this to stop any other element's currently-running animation that
	 * shares the same id when this step starts. Absent for steps outside any
	 * exclusive container.
	 */
	exclGroupId?: number;
	/**
	 * `p:cond/@tn` (ECMA-376 S19.5.28) this step's start condition depends on, a
	 * SPECIFIC time node id rather than a positional "the previous step". Only
	 * `dependsOnEvent === 'onStopAudio'` is consumed at playback today (see
	 * `animation-media-end-gating`'s `findMediaEndGatedSteps`): the referenced
	 * node's already-computed `delayMs`/`durationMs` fed into THIS step's own
	 * `delayMs` at build time (`animation-timeline-builder`) is only an
	 * ESTIMATE for a media node, since the real clip's playback duration is not
	 * knowable ahead of time (trimmed, or simply variable-length audio); a
	 * binding wires the referenced `<audio>`/`<video>` element's real `ended`
	 * event to start this step immediately instead, falling back to the
	 * estimate when no such element exists (export/headless). Other
	 * `dependsOnEvent` values (`onBegin`/`onEnd`) already resolve correctly via
	 * the computed delay alone, since a non-media node's `durationMs` is exact.
	 */
	dependsOnTimeNodeId?: number;
	/** The event of the time-node dependency above, when present. */
	dependsOnEvent?: AnimationConditionEvent;
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
	/**
	 * `p:seq/@concurrent` of the innermost enclosing sequence (ECMA-376
	 * S19.5.60), when this group's steps are governed by one. `true` lets this
	 * group's effects play alongside the surrounding timeline instead of
	 * blocking a "next" advance / hover-reset request while still active.
	 * Absent means no enclosing `p:seq` set it (the OOXML default is `false`,
	 * i.e. non-concurrent).
	 */
	seqConcurrent?: boolean;
	/**
	 * `p:seq/@nextAc` of the innermost enclosing sequence (ST_TLNextActionType,
	 * ECMA-376 S19.5.60). See {@link import('./animation-sequence-gating').shouldBlockNextAdvance}
	 * for how this is honoured.
	 */
	seqNextAction?: 'none' | 'seek';
	/**
	 * `p:seq/@prevAc` of the innermost enclosing sequence (ST_TLPreviousActionType,
	 * ECMA-376 S19.5.60). See {@link import('./animation-sequence-gating').shouldBlockReset}
	 * for how this is honoured.
	 */
	seqPrevAction?: 'none' | 'skipTimeNode';
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
	/** Interactive sequences whose `p:endSync/p:rtn val="all"` permits replay. */
	restartableInteractiveSequences?: ReadonlySet<string>;
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
	 * Authored-index chart reveal state (see {@link ChartRevealDescriptor}),
	 * present only when every fired chart-build step for this element carried
	 * `p:graphicEl` index data. A chart renderer prefers this over `build` when
	 * present; `chart-build`'s `resolveRevealedChartData` picks between the two.
	 */
	chartReveal?: { mode: ChartBuildMode; descriptor: ChartRevealDescriptor };
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
