/**
 * `animation-timeline-group` - click-group and whole-timeline models
 * ({@link TimelineClickGroup}, {@link AnimationTimeline},
 * {@link ElementAnimationState}, {@link AnimationStyle}), split out of
 * `animation-timeline-types` to keep that module under the file-size limit.
 * Re-exported from `animation-timeline-types` so existing imports are
 * unaffected.
 *
 * @module render/animation-timeline-group
 */

import type { TextStyleAnimationDescriptor } from './animation-text-style-resolve';
import type {
	ChartBuildMode,
	ChartRevealDescriptor,
	DiagramBuildMode,
	DiagramRevealDescriptor,
	ElementBuildState,
} from './animation-timeline-build-descriptors';
import type { TimelineStep } from './animation-timeline-step';

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
	 * Authored-index SmartArt diagram reveal state (see
	 * {@link DiagramRevealDescriptor}), present only when every fired
	 * diagram-build step for this element carried `p:graphicEl` node-id data.
	 * `diagram-build`'s `resolveRevealedSmartArtNodes` prefers this over `build`
	 * when present.
	 */
	diagramReveal?: { mode: DiagramBuildMode; descriptor: DiagramRevealDescriptor };
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
	/**
	 * Active discrete font-style / colour / size override (see
	 * {@link import('./animation-timeline-step').TimelineStep.textStyle}) a
	 * font-style emphasis effect currently applies to this element's text,
	 * OVERRIDING the runs' own inline bold/italic/underline/size/colour.
	 * `animation-playback-engine.ts` writes this on step start and again on
	 * cleanup (held in full when the effect's `p:cTn/@fill` holds its end
	 * state, otherwise reverted); a text renderer maps it onto its run markup
	 * via `buildTextStyleOverrideCss` (`animation-text-style-css.ts`). Absent
	 * means no font-style emphasis effect is currently active on this element.
	 */
	textStyle?: TextStyleAnimationDescriptor;
}

/**
 * Neutral CSS-properties shape returned by initial-style helpers. Bindings that
 * use a framework-specific style type (e.g. React's `CSSProperties`) cast this
 * at the boundary. Keys are camelCase to match inline-style objects.
 */
export type AnimationStyle = Record<string, string | number>;
