/**
 * Animation types: presets, triggers, timing, native parsed animation data,
 * and the high-level {@link PptxElementAnimation} associated with each element.
 *
 * @module pptx-types/animation
 */

import type { XmlObject } from './common';

// ==========================================================================
// Animation types
// ==========================================================================

/**
 * Built-in animation preset names used for entrance, exit, and emphasis effects.
 *
 * @example
 * ```ts
 * const preset: PptxAnimationPreset = "fadeIn";
 * // => "fadeIn" — one of: none | fadeIn | flyIn | zoomIn | fadeOut | flyOut | zoomOut | spin | pulse | ...
 * ```
 */
export type PptxAnimationPreset =
	| 'none'
	// Entrance
	| 'appear'
	| 'fadeIn'
	| 'flyIn'
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
	// Exit
	| 'fadeOut'
	| 'flyOut'
	| 'zoomOut'
	| 'bounceOut'
	| 'wipeOut'
	| 'shrinkOut'
	| 'dissolveOut'
	| 'disappear'
	// Emphasis
	| 'spin'
	| 'pulse'
	| 'colorWave'
	| 'bounce'
	| 'flash'
	| 'growShrink'
	| 'teeter'
	| 'transparency'
	| 'boldFlash'
	| 'wave';

/** Animation timing curve. */
export type PptxAnimationTimingCurve = 'ease' | 'ease-in' | 'ease-out' | 'linear';

/** Repeat mode for animations. */
export type PptxAnimationRepeatMode = 'untilNextClick' | 'untilEndOfSlide';

/** Animation trigger type from OOXML `p:cTn`. */
export type PptxAnimationTrigger =
	| 'onClick'
	| 'onShapeClick'
	| 'onHover'
	| 'afterPrevious'
	| 'withPrevious'
	| 'afterDelay';

/**
 * Native animation kind. The historic shape-targeted preset animations are
 * implicitly the default kind (`undefined`). Media animations (`p:audio`,
 * `p:video`) emit dedicated entries so playback order on the slide timeline
 * is preserved alongside other animations.
 */
export type PptxNativeAnimationKind = 'media';

/** A target selected by `p:tgtEl` in the PresentationML timing model. */
export type PptxAnimationTarget =
	| { type: 'shape'; shapeId: string; rawXml?: XmlObject }
	| { type: 'slide'; rawXml?: XmlObject }
	| { type: 'sound'; relationshipId: string; name?: string; rawXml?: XmlObject }
	| { type: 'ink'; shapeId: string; rawXml?: XmlObject }
	| { type: 'unknown'; rawXml: XmlObject };

/** Nested build choice carried by `p:bldGraphic`. */
export type PptxGraphicBuild =
	| { mode: 'asOne'; rawXml?: XmlObject }
	| {
			mode: 'sub';
			kind: 'diagram';
			build: string;
			reverse: boolean;
			rawXml?: XmlObject;
	  }
	| {
			mode: 'sub';
			kind: 'chart';
			build: string;
			animateBackground: boolean;
			rawXml?: XmlObject;
	  };

/**
 * A single `p:tmpl` timing template parsed from a TEXT `p:bldP/p:tmplLst`
 * (CT_TLTemplate, ECMA-376 §19.5.85; the list itself is CT_TLTemplateList,
 * §19.5.84).
 *
 * PowerPoint writes these as the timing PowerPoint would apply to a build
 * level that does not yet have an instantiated effect, so that promoting or
 * demoting an outline paragraph, or adding a new bullet at a level with no
 * prior animation, has a default to clone. They are not consulted at
 * playback: the animation actually shown for every paragraph level already
 * visible on the slide is the real, instantiated `p:tnLst` under
 * `p:timing/p:tnLst`, which the rest of this parser already models in full.
 *
 * The nested time-node tree under each template's own `p:tnLst` is kept as
 * a preserved `XmlObject` rather than deep-parsed into
 * {@link PptxNativeAnimation} records: it is schema-identical to the
 * top-level timing tree but scoped to a template that is never itself
 * executed, so structurally modelling it would stand up a second, unused
 * parallel animation model. Parsing stops at typed round-trip; see
 * `docs/guide/limitations.md`.
 */
export interface PptxTimingTemplate {
	/** Build level this template targets, from `p:tmpl/@lvl` (ST_TLLevel, default 0). */
	level: number;
	/** Preserved `p:tnLst` (CT_TimeNodeList) subtree, verbatim. */
	timeNodeList: XmlObject;
	/** Preserved `p:tmpl` XML node (its attributes plus any unmodelled children). */
	rawXml?: XmlObject;
}

/**
 * Parsed native animation record from `p:timing / p:tnLst`.
 *
 * Represents a single animation node in the OOXML timing tree,
 * including motion paths, scale transforms, and text build settings.
 *
 * @example
 * ```ts
 * const anim: PptxNativeAnimation = {
 *   targetId: "shape_1",
 *   presetClass: "entr",
 *   presetId: 10,
 *   trigger: "afterPrevious",
 *   durationMs: 500,
 * };
 * // => { targetId: "shape_1", presetClass: "entr", presetId: 10, trigger: "afterPrevious", durationMs: 500 }
 * ```
 */
export interface PptxNativeAnimation {
	/** Target element/shape ID. */
	targetId?: string;
	/** Full timing target, including sound and ink target variants. */
	target?: PptxAnimationTarget;
	/** Trigger type. */
	trigger?: PptxAnimationTrigger;
	/** Shape ID that triggers this animation when clicked (interactive sequence). */
	triggerShapeId?: string;
	/** Effect preset class (entr, exit, emph, path). */
	presetClass?: 'entr' | 'exit' | 'emph' | 'path';
	/** Effect preset sub-type identifier. */
	presetId?: number;
	/**
	 * Effect preset direction/variant code from `p:cTn/@presetSubtype`
	 * (ECMA-376 CT_TLCommonTimeNodeData). For Fly In/Out this encodes the
	 * edge/corner the object travels from as a bitmask (1=top, 2=right,
	 * 4=bottom, 8=left; corners combine bits). Absent means the preset default.
	 */
	presetSubtype?: number;
	/** Duration in milliseconds. */
	durationMs?: number;
	/** Delay in milliseconds. */
	delayMs?: number;
	/**
	 * Acceleration fraction in the range 0..1, parsed from `p:cTn/@accel`
	 * (ST_PositiveFixedPercentage, stored as 1000ths of a percent). A non-zero
	 * value means the effect eases in (starts slow). Absent means no easing-in.
	 */
	accel?: number;
	/**
	 * Deceleration fraction in the range 0..1, parsed from `p:cTn/@decel`.
	 * A non-zero value means the effect eases out (ends slow). Absent means no
	 * easing-out. When both {@link accel} and {@link decel} are set, the effect
	 * eases in and out.
	 */
	decel?: number;
	/** Trigger delay in milliseconds (for afterDelay). */
	triggerDelayMs?: number;
	/** SVG path string for motion path animations (`p:animMotion/@path`). */
	motionPath?: string;
	/** Motion origin: "layout" or "parent". */
	motionOrigin?: string;
	/**
	 * Whether the element auto-rotates to follow the motion path tangent.
	 * Viewer-authoring-only hint: OOXML has no such flag (`p:animMotion/@rAng`
	 * is a plain rotation angle that PowerPoint writes as "0" on every path),
	 * so the parser never sets this.
	 */
	motionPathRotateAuto?: boolean;
	/** Path edit mode from `p:animMotion/@pathEditMode` (e.g. "relative", "fixed"). */
	motionPathEditMode?: string;
	/** Comma-separated point-types string from `p:animMotion/@ptsTypes`. */
	motionPtsTypes?: string;
	/** Rotation angle in degrees for `p:animRot/@by` (converted from 60000ths). */
	rotationBy?: number;
	/** Starting rotation angle in degrees for `p:animRot/@from` (converted from 60000ths). */
	rotationFrom?: number;
	/** Ending rotation angle in degrees for `p:animRot/@to` (converted from 60000ths). */
	rotationTo?: number;
	/** X scale factor (percentage / 100) for `p:animScale/p:by/@x`. */
	scaleByX?: number;
	/** Y scale factor (percentage / 100) for `p:animScale/p:by/@y`. */
	scaleByY?: number;
	/** Starting X scale factor for `p:animScale/p:from/@x`. */
	scaleFromX?: number;
	/** Starting Y scale factor for `p:animScale/p:from/@y`. */
	scaleFromY?: number;
	/** Ending X scale factor for `p:animScale/p:to/@x`. */
	scaleToX?: number;
	/** Ending Y scale factor for `p:animScale/p:to/@y`. */
	scaleToY?: number;
	/** Whether `p:animScale/@zoomContents` was set ("1"/"true"). */
	scaleZoomContents?: boolean;
	/** Parsed `p:tav` keyframes from `p:tavLst` (CT_TLAnimVariantList). */
	keyframes?: PptxAnimationKeyframe[];
	/** Repeat count (e.g. `2`, `Infinity` for indefinite). */
	repeatCount?: number;
	/** Whether the animation plays in reverse after completion. */
	autoReverse?: boolean;
	/** Text build type from `p:bldP/@build` in `p:bldLst`. */
	buildType?: PptxTextBuildType;
	/** Build level for multi-level lists from `p:bldP/@bldLvl`. */
	buildLevel?: number;
	/** Group ID linking a `p:bldP` entry to its timing animation node. */
	groupId?: string;
	/** Sound relationship ID to play when animation triggers (`p:stSnd`). */
	soundRId?: string;
	/** Resolved sound file path from relationship. */
	soundPath?: string;
	/** Whether to stop any currently playing sound (`p:endSnd`). */
	stopSound?: boolean;
	/**
	 * End-state behaviour from `p:cTn/@fill` (ST_TLTimeNodeFillType, ECMA-376
	 * §19.5.27). `hold`/`freeze` mean the effect's final frame persists after
	 * it finishes; `remove` (the default when absent) means the target reverts
	 * to its pre-effect appearance. `transition` behaves like `hold` until the
	 * next time node starts. Absent means the OOXML default (`remove`).
	 */
	fill?: 'remove' | 'freeze' | 'hold' | 'transition';
	/**
	 * Restart behaviour from `p:cTn/@restart` (ST_TLTimeNodeRestartType).
	 * Absent means the OOXML default (`always`).
	 */
	restart?: 'always' | 'whenNotActive' | 'never';
	/**
	 * Repeat duration in milliseconds from `p:cTn/@repeatDur`. `Infinity`
	 * represents the literal `"indefinite"` token.
	 */
	repeatDurMs?: number;
	/**
	 * Playback speed multiplier from `p:cTn/@spd` (ST_Percentage, normalized
	 * from OOXML's 1000ths-of-a-percent storage to a plain percentage, e.g.
	 * `150` for 150% / double speed). Absent means normal (100%) speed.
	 */
	speedPct?: number;
	/**
	 * Reverse the paragraph build order from `p:bldP/@rev` (TEXT build only).
	 * Not to be confused with {@link PptxGraphicBuild}'s `reverse` field, which
	 * carries the unrelated `p:bldDgm`/`@rev` DIAGRAM-build reverse flag.
	 */
	buildReverse?: boolean;
	/**
	 * Auto-advance time in milliseconds from `p:bldP/@advAuto`. `Infinity`
	 * represents the literal `"indefinite"` token. Absent means the build
	 * step waits for a click.
	 */
	buildAdvAutoMs?: number;
	/**
	 * Per-build-level timing templates from a TEXT `p:bldP/p:tmplLst`
	 * (ECMA-376 §19.5.84 CT_TLTemplateList). Parsed for round-trip only; see
	 * {@link PptxTimingTemplate} for why they are not consulted at playback.
	 */
	buildTemplates?: PptxTimingTemplate[];
	/**
	 * Whether the enclosing `p:seq` allows concurrent play with its siblings,
	 * from `p:seq/@concurrent`. Parsed for round-trip; not yet honoured by
	 * playback (see `docs/guide/limitations.md`).
	 */
	seqConcurrent?: boolean;
	/** Next-action behaviour from `p:seq/@nextAc` (ST_TLNextActionType). */
	seqNextAction?: 'none' | 'seek';
	/** Previous-action behaviour from `p:seq/@prevAc` (ST_TLPreviousActionType). */
	seqPrevAction?: 'none' | 'skipTimeNode';
	/**
	 * Whether the enclosing click-level group (a direct `p:par` child of the
	 * `mainSeq`) begins automatically when the slide appears, rather than waiting
	 * for a click.
	 *
	 * PowerPoint gates a click step with a lone `<p:cond delay="indefinite"/>`;
	 * a group that also carries a time-node condition (`onBegin`/`onEnd` with a
	 * `@tn`) or a finite delay starts on slide entry ("With/After Previous" as the
	 * first effect on the slide). The flat animation list cannot express that on
	 * its own, so the parse layer stamps it here.
	 */
	groupAutoStart?: boolean;
	/**
	 * Index of the enclosing effect-wrapper `p:par` inside the click-level group.
	 *
	 * Effects that share a wrapper are OOXML siblings: they all start when that
	 * wrapper starts, and each `p:cond/@delay` is measured from the wrapper's
	 * start, NOT chained off the effect before it. Playback uses this to place
	 * simultaneous effects at their true offsets instead of accumulating delays.
	 */
	parGroupIndex?: number;
	/** Structured start conditions parsed from `p:stCondLst`. */
	startConditions?: AnimationCondition[];
	/** Structured end conditions parsed from `p:endCondLst`. */
	endConditions?: AnimationCondition[];
	/** Preserved raw `p:endCondLst` XML node for lossless round-trip. */
	rawEndCondLst?: XmlObject;
	/** Color animation data from `p:animClr`. */
	colorAnimation?: PptxColorAnimation;
	/** Text-level target: character range or paragraph range from `p:txEl`. */
	textTarget?: PptxTextAnimationTarget;
	/** Whether this animation is inside an exclusive container (`p:excl`). */
	exclusive?: boolean;
	/** Command type from `p:cmd` (@_type: call/evt/verb). */
	commandType?: string;
	/** Command string from `p:cmd` (@_cmd). */
	commandString?: string;
	/** Iteration configuration from `p:iterate`. */
	iterate?: PptxAnimationIterate;
	/**
	 * Discriminator for non-preset animation kinds. When `undefined`, the
	 * entry represents the default shape-effect animation. The `'media'`
	 * kind represents a `p:audio` / `p:video` timing node, captured here so
	 * playback order in the timeline is preserved alongside other animations.
	 */
	kind?: PptxNativeAnimationKind;
	/**
	 * For `kind === 'media'`, identifies whether this is an audio or video
	 * media node so writers know which OOXML element to re-emit.
	 */
	mediaType?: 'audio' | 'video';
	/**
	 * SmartArt build attribute (`p:bldDgm/@bld`) when this animation is
	 * associated with a SmartArt diagram build. Common values include
	 * `whole`, `one`, `lvlOne`, `lvlAtOnce`.
	 */
	smartArtBuild?: string;
	/**
	 * Graphic-frame build attribute (`p:bldGraphic/@bld`) when this animation
	 * is associated with a generic graphic frame build (charts, tables, etc.
	 * that aren't OLE charts).
	 */
	graphicBuild?: string;
	/**
	 * OLE-embedded chart build attribute (`p:bldOleChart/@bld`) when this
	 * animation stages an OLE chart graphic frame. Values follow
	 * ST_TLOleChartBuildType: `allAtOnce`, `series`, `category`, `seriesEl`,
	 * `categoryEl`. Lets a staged-reveal renderer build the chart by series /
	 * category / element to match PowerPoint, rather than as one whole element.
	 */
	oleChartBuild?: string;
	/** Schema-accurate `p:bldGraphic/p:bldAsOne|p:bldSub` representation. */
	graphicBuildProperties?: PptxGraphicBuild;
	/**
	 * Opaque map of `p:cTn` attributes that don't have a typed home on this
	 * interface but must round-trip through parse → save. Keys are stored
	 * verbatim including the `@_` prefix used by the underlying XML parser
	 * (e.g. `@_evtFilter`, `@_display`, `@_masterRel`, `@_nodePh`,
	 * `@_endSync`, `@_progress`). The `subTnLst` child element is also
	 * preserved here under the literal key `p:subTnLst`. The `afterEffect`
	 * attribute is surfaced separately as a typed boolean ({@link afterEffect})
	 * because it changes write semantics for subsequent timing nodes.
	 */
	cTnAttributes?: Record<string, unknown>;
	/**
	 * Whether the OOXML `p:cTn/@afterEffect` flag is set. Indicates this node
	 * runs after the parent effect's main body has completed; affects how
	 * subsequent peer nodes are sequenced when serialised back to OOXML.
	 */
	afterEffect?: boolean;
	/**
	 * "After animation" end-state behaviour carried over from the matching
	 * {@link PptxElementAnimation.afterAnimation} entry for this effect's
	 * element. Not populated by the native-timing parser itself (there is no
	 * single `p:cTn` attribute for it): `applyAfterAnimationFromEditorList` in
	 * `pptx-viewer-shared` merges it in from the editor's per-element
	 * animation list before playback, since that is the model the animation
	 * panel writes `afterAnimation` into.
	 */
	afterAnimationAction?: PptxAfterAnimationAction;
	/** Dim-to color hex, present when {@link afterAnimationAction} is `dimToColor`. */
	afterAnimationColor?: string;
	/**
	 * Parsed `p:animEffect` filter descriptor. `presetId`/`presetClass` remain
	 * the primary effect selector (see `resolveEffect` in `pptx-viewer-shared`);
	 * this is the fallback used when a preset table lookup misses (unmapped or
	 * absent `presetId`), which happens for decks authored by tools other than
	 * PowerPoint that only emit the SMIL-style filter string.
	 */
	effectFilter?: PptxAnimationEffectFilter;
}

/**
 * Parsed `p:animEffect/@filter` (+ `@transition`) descriptor. ECMA-376
 * describes `@filter` as a free-form string of the form `family(subtype)`,
 * optionally followed by `;`-separated fallback candidates (only the first
 * is honoured, per ECMA-376 S19.5.3's "first supported filter wins" rule).
 *
 * @example
 * ```ts
 * const f: PptxAnimationEffectFilter = { family: 'wipe', subtype: 'up', transition: 'in', raw: 'wipe(up)' };
 * ```
 */
export interface PptxAnimationEffectFilter {
	/** Filter family name (e.g. `"wipe"`, `"barn"`, `"checkerboard"`), lowercased. */
	family: string;
	/**
	 * Parenthesised subtype/direction token verbatim (e.g. `"up"`,
	 * `"inVertical"`, `"across"`, `"4"`). Absent when the filter has no
	 * subtype (e.g. bare `"dissolve"`).
	 */
	subtype?: string;
	/**
	 * `p:animEffect/@transition`: `"in"` reveals the target (the OOXML
	 * default when the attribute is omitted), `"out"` conceals it, `"none"`
	 * applies the filter without a visibility change (a static filter pass).
	 */
	transition?: 'in' | 'out' | 'none';
	/** Raw filter string exactly as authored, for round-trip/debugging. */
	raw: string;
}

/**
 * Single keyframe parsed from a `p:tav` element (CT_TLTimeAnimateValue).
 *
 * Each entry in a `p:tavLst` has a time fraction (`@_tm`, in 1000ths of the
 * total duration; or the literal "indefinite" / "large") and a typed value
 * child under `p:val/p:strVal|p:boolVal|p:intVal|p:fltVal|p:clrVal`.
 *
 * @see ECMA-376 §19.5.30 CT_TLAnimVariantList / §19.5.92 CT_TLTimeAnimateValue
 */
export interface PptxAnimationKeyframe {
	/**
	 * Time fraction. A finite number is the OOXML `@_tm` integer (0–100000
	 * for percentage, where 100000 = 100% of duration). A string preserves
	 * special tokens ("indefinite", "large").
	 */
	tm: number | string;
	/** Decoded keyframe value. */
	value: string | boolean | number;
	/** Discriminant indicating which `p:val` child carried the value. */
	valueType: 'str' | 'bool' | 'int' | 'flt' | 'clr';
	/**
	 * Optional formula carried on `p:tav/@_fmla`. Preserved for round-trip
	 * fidelity; consumers may use it to drive computed animation values.
	 */
	fmla?: string;
}

/** Color animation data parsed from `p:animClr`. */
export interface PptxColorAnimation {
	/** Color interpolation space: "hsl" or "rgb". */
	colorSpace: 'hsl' | 'rgb';
	/** Direction for HSL interpolation: "cw" (clockwise) or "ccw". */
	direction?: 'cw' | 'ccw';
	/**
	 * Optional `p:animClr/@path` value preserved for round-trip. When set,
	 * the colour sweep follows a path-based interpolation rather than the
	 * straight cw/ccw arc. ECMA-376 §19.5.13 documents this attribute as a
	 * companion to `@dir` for HSL colour-space animations.
	 */
	path?: string;
	/** Starting color as hex string. */
	fromColor?: string;
	/** Ending color as hex string. */
	toColor?: string;
	/**
	 * Color delta (for "by" animations) as hex string. For HSL colour-space
	 * animations the value encodes a delta over hue/sat/lum and is preserved
	 * verbatim from the source.
	 */
	byColor?: string;
	/**
	 * Target attribute from `p:attrNameLst` (e.g. "fillcolor", "style.color",
	 * "stroke.color"). Used to determine which CSS property to animate.
	 */
	targetAttribute?: string;
}

/** Text-level animation target from `p:txEl`. */
export interface PptxTextAnimationTarget {
	/** Target type: character range or paragraph range. */
	type: 'charRg' | 'pRg';
	/** Start index (0-based). */
	start: number;
	/** End index (exclusive). */
	end: number;
}

/**
 * Event types for animation conditions from `p:cond/@evt`.
 *
 * These map directly to OOXML condition event attribute values
 * (ISO/IEC 29500-1 S19.5.28 CT_TLTimeCondition).
 */
export type AnimationConditionEvent =
	| 'onBegin'
	| 'onEnd'
	| 'begin'
	| 'end'
	| 'onClick'
	| 'onMouseOver'
	| 'onMouseOut'
	| 'onNext'
	| 'onPrev'
	| 'onStopAudio';

/**
 * Structured representation of a single OOXML animation condition
 * from `p:cond` elements inside `p:stCondLst` or `p:endCondLst`.
 *
 * Conditions control when an animation starts or ends, and can reference
 * events, time delays, and target time node IDs.
 *
 * @example
 * ```ts
 * const cond: AnimationCondition = {
 *   event: "onClick",
 *   delay: 0,
 *   targetShapeId: "shape_5",
 * };
 * ```
 */
export interface AnimationCondition {
	/** Event that triggers the condition. */
	event?: AnimationConditionEvent;
	/** Delay in milliseconds (from `@_delay`). "indefinite" is represented as -1. */
	delay?: number;
	/** Target time node ID reference (from `@_tn`). */
	targetTimeNodeId?: number;
	/** Target shape ID from `p:tgtEl/p:spTgt/@spid`. */
	targetShapeId?: string;
	/** Whether the condition targets a slide (from `p:tgtEl/p:sldTgt`). */
	targetSlide?: boolean;
	/** Full target choice, including `p:sndTgt` and `p:inkTgt`. */
	target?: PptxAnimationTarget;
}

/** Iteration configuration from `p:iterate`. */
export interface PptxAnimationIterate {
	/** Iteration type: el (element), lt (letter), wd (word). */
	type: 'el' | 'lt' | 'wd';
	/** Whether to iterate backwards. */
	backwards?: boolean;
	/** Timing interval (percentage of total duration, in 1000ths). */
	tmPct?: number;
	/** Absolute timing interval in ms. */
	tmAbs?: number;
}

/** Build type for text build (paragraph/word/letter) animations from `p:bldP/@build`. */
export type PptxTextBuildType = 'allAtOnce' | 'byParagraph' | 'byWord' | 'byChar';

/** Direction for fly-in / fly-out / wipe effects. */
export type PptxAnimationDirection =
	| 'fromLeft'
	| 'fromRight'
	| 'fromTop'
	| 'fromBottom'
	| 'fromTopLeft'
	| 'fromTopRight'
	| 'fromBottomLeft'
	| 'fromBottomRight';

/** Sequence mode for paragraph-level animations. */
export type PptxAnimationSequence = 'asOne' | 'byParagraph' | 'byWord' | 'byLetter';

/** Behavior after animation finishes. */
export type PptxAfterAnimationAction =
	| 'none'
	| 'hideOnNextClick'
	| 'hideAfterAnimation'
	| 'dimToColor';

/**
 * High-level animation data associated with a slide element.
 *
 * Combines entrance, exit, and emphasis presets with timing and
 * trigger configuration. Used by the editor’s animation panel
 * and the `setPptxElementAnimation` tool.
 *
 * @example
 * ```ts
 * const anim: PptxElementAnimation = {
 *   elementId: "title_1",
 *   entrance: "fadeIn",
 *   durationMs: 600,
 *   order: 1,
 *   trigger: "afterPrevious",
 * };
 * // => { elementId: "title_1", entrance: "fadeIn", durationMs: 600, order: 1, trigger: "afterPrevious" }
 * ```
 */
export interface PptxElementAnimation {
	elementId: string;
	entrance?: PptxAnimationPreset;
	exit?: PptxAnimationPreset;
	emphasis?: PptxAnimationPreset;
	durationMs?: number;
	delayMs?: number;
	order?: number;
	trigger?: PptxAnimationTrigger;
	/** Shape ID that triggers this animation when clicked (interactive sequence). */
	triggerShapeId?: string;
	timingCurve?: PptxAnimationTimingCurve;
	repeatCount?: number;
	repeatMode?: PptxAnimationRepeatMode;
	/** Direction for directional effects (fly in/out, wipe, etc.). */
	direction?: PptxAnimationDirection;
	/** Sequence mode — animate as one object or by paragraph/word/letter. */
	sequence?: PptxAnimationSequence;
	/** What happens after the animation finishes playing. */
	afterAnimation?: PptxAfterAnimationAction;
	/** Dim-to color hex (used when afterAnimation is "dimToColor"). */
	afterAnimationColor?: string;
	/** SVG motion path string for custom motion path animations. */
	motionPath?: string;
	/**
	 * Path edit mode for `p:animMotion/@pathEditMode`. Defaults to "relative"
	 * when emitted without an explicit value.
	 */
	motionPathEditMode?: string;
	/** Comma-separated point-types string for `p:animMotion/@ptsTypes`. */
	motionPtsTypes?: string;
	/** Sound relationship ID to play when animation triggers (`p:stSnd`). */
	soundRId?: string;
	/** Resolved sound file path from relationship. */
	soundPath?: string;
	/** Whether to stop any currently playing sound (`p:endSnd`). */
	stopSound?: boolean;
	/**
	 * Pending, not-yet-embedded sound chosen in the authoring UI, as a
	 * `data:audio/...;base64,...` URL. Mirrors the `imageData` /
	 * `mediaData` pending-embed convention used elsewhere in the typed model:
	 * on save, the writer converts this to real bytes under `ppt/media/`,
	 * mints a relationship, and replaces this field with the resolved
	 * {@link soundRId} / {@link soundPath}. Cleared once embedded.
	 */
	soundData?: string;
	/**
	 * Display name for the chosen sound (e.g. the uploaded file's name),
	 * shown by the authoring UI's sound picker. Purely cosmetic; has no
	 * OOXML equivalent and is not required for playback.
	 */
	soundFileName?: string;
}
