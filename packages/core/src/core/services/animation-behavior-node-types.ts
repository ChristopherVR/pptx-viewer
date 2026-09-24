/**
 * Shared types for the COM-derived "real PowerPoint behaviour tree" preset
 * tables (`animation-behavior-*.ts`). These tables replace the historic
 * "every preset writes `p:animEffect filter=\"fade\"`" placeholder in
 * `animation-write-node-behaviors.ts` with the actual child-node shape
 * retail PowerPoint writes for a given `(presetClass, presetId)`, derived by
 * `Slide.TimeLine.MainSequence.AddEffect` + raw OOXML inspection (see the
 * module doc on `animation-behavior-table.ts` for the full methodology and
 * a pointer at the raw captures).
 *
 * @module services/animation-behavior-node-types
 */

/** One `p:tav` stop for a generic `p:anim` behaviour. */
export interface AnimBehaviorTav {
	tm: number;
	val: string;
	valType?: 'str' | 'flt';
	/** `p:tav/@_fmla`, e.g. `#ppt_y-sin(pi*$)/3` (see Bounce). */
	fmla?: string;
}

/** Timing shared by every behaviour node kind (all in milliseconds, scaled by the caller). */
export interface AnimBehaviorTiming {
	durMs: number;
	delayMs?: number;
	accel?: number;
	decel?: number;
	autoRev?: boolean;
	/** `p:cTn/@_fill`; most behaviour nodes omit it (inherits from the parent effect). */
	fill?: 'hold' | 'remove';
	/** `p:cTn/@_tmFilter` (a decel/accel curve as `"t,v; t,v; ..."`). */
	tmFilter?: string;
}

/** Params for a generic property `p:anim` (attribute interpolation) behaviour. */
export interface AnimNodeSpec extends AnimBehaviorTiming {
	kind: 'anim';
	attrName: string;
	tav?: AnimBehaviorTav[];
	from?: string;
	to?: string;
	by?: string;
	additive?: 'sum' | 'base';
}

/** Params for a `p:animEffect` (built-in transition filter) behaviour. */
export interface AnimEffectNodeSpec extends AnimBehaviorTiming {
	kind: 'animEffect';
	/** Omitted for the rare preset (e.g. Transparency) whose `p:animEffect` carries no `@_transition`. */
	transition?: 'in' | 'out';
	filter?: string;
	prLst?: string;
}

/** Params for a `p:animScale` behaviour. */
export interface AnimScaleNodeSpec extends AnimBehaviorTiming {
	kind: 'animScale';
	mode:
		| { form: 'to'; x: number; y: number }
		| { form: 'by'; x: number; y: number }
		| { form: 'fromTo'; fromX: number; fromY: number; toX: number; toY: number };
}

/** Params for a `p:animRot` behaviour. */
export interface AnimRotNodeSpec extends AnimBehaviorTiming {
	kind: 'animRot';
	by: number;
}

/** Params for a `p:animClr` behaviour. */
export interface AnimClrNodeSpec extends AnimBehaviorTiming {
	kind: 'animClr';
	attrName: string;
	clrSpc: 'hsl' | 'rgb';
	dir?: 'cw' | 'ccw';
	overrideChildStyle?: boolean;
	mode: { form: 'byHsl'; h: number; s: number; l: number } | { form: 'toSchemeClr'; val: string };
}

/** Params for a `p:animMotion` (motion-path) behaviour. */
export interface AnimMotionNodeSpec extends AnimBehaviorTiming {
	kind: 'animMotion';
	path: string;
	origin?: string;
	pathEditMode?: string;
}

/** Params for a plain `p:set` behaviour (discrete value toggle). */
export interface SetNodeSpec extends AnimBehaviorTiming {
	kind: 'set';
	attrName: string;
	to: string;
}

/** Union of every behaviour node this table can describe. */
export type AnimBehaviorNodeSpec =
	| AnimNodeSpec
	| AnimEffectNodeSpec
	| AnimScaleNodeSpec
	| AnimRotNodeSpec
	| AnimClrNodeSpec
	| AnimMotionNodeSpec
	| SetNodeSpec;

/**
 * A COM-derived behaviour-tree override for one `(presetClass, presetId)`
 * (optionally further split by `presetSubtype`, e.g. Fly's 8 directions).
 * When present, the writer uses `nodes` verbatim instead of the historic
 * single `p:animEffect filter="fade"` placeholder.
 */
export interface AnimationBehaviorTemplate {
	/**
	 * Behaviour nodes, expressed as fractions of `durationMs` for every timing
	 * field (`durMs`/`delayMs` of `1` == the caller's full requested duration)
	 * so multi-phase choreography (Bounce, Float, Grow & Turn) scales with the
	 * user's chosen speed while keeping PowerPoint's authored relative timing.
	 * `buildAnimationBehaviorNodes` multiplies every timing field by the
	 * caller's `durationMs` and rounds to the nearest millisecond.
	 */
	nodes: ReadonlyArray<AnimBehaviorNodeSpec>;
	/**
	 * The ground-truth choreography's own total duration in milliseconds, used
	 * only to document what "fraction 1.0" corresponds to; not consulted at
	 * generation time (every field is already a fraction).
	 */
	baselineDurationMs: number;
}
