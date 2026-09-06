/**
 * `animation-timeline-step` - the per-step timeline models
 * ({@link AnimationStep}, {@link TimelineStepCommand}, {@link TimelineStep}),
 * split out of `animation-timeline-types` to keep that module under the
 * file-size limit. Re-exported from `animation-timeline-types` so existing
 * imports are unaffected.
 *
 * @module render/animation-timeline-step
 */

import type { AnimationConditionEvent, PptxAnimationTrigger } from 'pptx-viewer-core';

import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import type {
	ColorAnimationTarget,
	StepBuildDescriptor,
	TimelineStepGraphicElement,
} from './animation-timeline-build-descriptors';

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
	 * onto the owning {@link import('./animation-timeline-group').TimelineClickGroup}
	 * by `finalizeClickGroup`; see that type's own field for the playback
	 * meaning.
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
	 * Mutually exclusive with {@link dependsOnShapeId}: an OOXML `p:cond` names
	 * its dependency by EITHER a time-node id OR a shape, never both.
	 */
	dependsOnTimeNodeId?: number;
	/**
	 * `p:cond/@evt="onStopAudio"` naming its dependency by SHAPE instead of
	 * time-node id (`p:tgtEl/p:spTgt/@_spid`, no `@_tn`): the media element's
	 * own shape/element id, in the same id space as {@link elementId} and
	 * `data-element-id`. `animation-media-end-gating`'s `wireMediaEndedSteps`
	 * resolves this directly against the live DOM (no node-id -> element-id map
	 * needed, unlike {@link dependsOnTimeNodeId}). See
	 * `EffectiveStartCondition.dependsOnShapeId` in `animation-advanced-triggers`
	 * for why this alternative form exists.
	 */
	dependsOnShapeId?: string;
	/** The event of the time-node/shape dependency above, when present. */
	dependsOnEvent?: AnimationConditionEvent;
	/**
	 * Discrete font-style / colour / size override this step's effect composes
	 * via `p:set` siblings and/or a `style.fontsize`/boolean `p:anim` ramp (Bold
	 * Flash, Bold Reveal, Underline, Brush On Underline, Change Font Style,
	 * Change Font Size), resolved by `resolveTextStyleAnimation`
	 * (`animation-text-style-resolve.ts`). Absent for every effect that carries
	 * none of those attrs, so existing renderers are unaffected. See
	 * {@link import('./animation-timeline-group').ElementAnimationState.textStyle}
	 * for how the playback engine carries this through step start / cleanup.
	 */
	textStyle?: TextStyleAnimationDescriptor;
}
