/**
 * Slide transition types and the {@link PptxSlideTransition} data structure.
 *
 * Represents the `<p:transition>` element on each slide, including
 * transition type, duration, direction, and advance timing.
 *
 * @module pptx-types/transition
 */

// ==========================================================================
// Slide transition types
// ==========================================================================

import type { XmlObject } from './common';

/**
 * Available slide transition effects.
 *
 * Maps to the OOXML child element names under `<p:transition>` / `<p14:transition>`.
 *
 * @example
 * ```ts
 * const t: PptxTransitionType = "morph";
 * // => "morph" — one of 40+ transition effects
 * ```
 */
export type PptxTransitionType =
	| 'none'
	| 'cut'
	| 'fade'
	| 'push'
	| 'wipe'
	| 'split'
	| 'randomBar'
	| 'blinds'
	| 'checker'
	| 'circle'
	| 'comb'
	| 'cover'
	| 'diamond'
	| 'dissolve'
	| 'plus'
	| 'pull'
	| 'random'
	| 'strips'
	| 'uncover'
	| 'wedge'
	| 'wheel'
	| 'zoom'
	| 'newsflash'
	| 'morph'
	| 'conveyor'
	| 'doors'
	| 'ferris'
	| 'flash'
	| 'flythrough'
	| 'gallery'
	| 'glitter'
	| 'honeycomb'
	| 'pan'
	| 'prism'
	| 'reveal'
	| 'ripple'
	| 'shred'
	| 'switch'
	| 'vortex'
	| 'warp'
	| 'wheelReverse'
	| 'window'
	| 'cube'
	| 'flip'
	| 'rotate'
	| 'box'
	| 'orbit'
	| 'fallOver'
	| 'drape'
	| 'curtains'
	| 'wind'
	| 'prestige'
	| 'fracture'
	| 'crush'
	| 'peelOff'
	| 'pageCurlDouble'
	| 'pageCurlSingle'
	| 'airplane'
	| 'origami';

/** Cardinal direction tokens from OOXML transition `@_dir`. */
export type PptxTransitionDirection4 = 'l' | 'r' | 'u' | 'd';

/** 8-way direction tokens (cardinal + diagonal) for cover/uncover. */
export type PptxTransitionDirection8 = PptxTransitionDirection4 | 'lu' | 'ld' | 'ru' | 'rd';

/** Strip direction tokens from OOXML. */
export type PptxStripDirection = 'lu' | 'ld' | 'ru' | 'rd';

/** Split orientation from OOXML `@_orient`. */
export type PptxSplitOrientation = 'horz' | 'vert';

/** Split in/out direction from OOXML `@_dir`. */
export type PptxSplitDirection = 'in' | 'out';

/** Schema-defined `ST_TransitionSpeed` values. */
export type PptxTransitionSpeed = 'slow' | 'med' | 'fast';

/**
 * Valid direction sets per transition type.
 *
 * The p14 (Office 2010+) and p15 (Office 2013+) entries below are COM-verified:
 * each direction token was confirmed by enumerating PowerPoint's own
 * `PpEntryEffect` constants (reflected off the installed
 * `Microsoft.Office.Interop.PowerPoint` type library) and reading back the
 * `p:transition` XML PowerPoint itself saved for each one, exactly like the
 * `p14-prism-family` and `P15_INVX_PRESETS` measurements. Two findings that
 * contradict the naive "4-way cardinal for every named Left/Up/Right/Down
 * effect" assumption:
 *  - `switch` and `flip` each expose four named directions in PowerPoint's UI
 *    (Left/Up/Right/Down), but the saved XML only ever carries `dir="l"` or
 *    `dir="r"`: Up and Down both collapse to `dir="r"` on save. Modelling them
 *    as 4-way here would offer a picker button PowerPoint itself cannot
 *    persist.
 *  - `ripple`'s only named directions are the four DIAGONALS (`lu`/`ld`/`ru`/
 *    `rd`, PowerPoint's "Ripple" gallery calls them Left-Up/Left-Down/etc.);
 *    there is no cardinal `l`/`r`/`u`/`d` variant, and the unset default is a
 *    fifth "From Center" state with no `dir` attribute at all.
 */
export const TRANSITION_VALID_DIRECTIONS: Readonly<
	Partial<Record<PptxTransitionType, readonly string[]>>
> = {
	push: ['l', 'r', 'u', 'd'] as const,
	wipe: ['l', 'r', 'u', 'd'] as const,
	cover: ['l', 'r', 'u', 'd', 'lu', 'ld', 'ru', 'rd'] as const,
	uncover: ['l', 'r', 'u', 'd', 'lu', 'ld', 'ru', 'rd'] as const,
	pull: ['l', 'r', 'u', 'd', 'lu', 'ld', 'ru', 'rd'] as const,
	strips: ['lu', 'ld', 'ru', 'rd'] as const,
	split: ['in', 'out'] as const,
	blinds: ['horz', 'vert'] as const,
	checker: ['horz', 'vert'] as const,
	comb: ['horz', 'vert'] as const,
	randomBar: ['horz', 'vert'] as const,
	// p14 (Office 2010+) extended transitions, COM-verified (see doc comment above).
	vortex: ['l', 'u', 'r', 'd'] as const,
	ripple: ['lu', 'ld', 'ru', 'rd'] as const,
	glitter: ['l', 'u', 'r', 'd'] as const,
	gallery: ['l', 'r'] as const,
	conveyor: ['l', 'r'] as const,
	ferris: ['l', 'r'] as const,
	switch: ['l', 'r'] as const,
	flip: ['l', 'r'] as const,
	shred: ['in', 'out'] as const,
	cube: ['l', 'u', 'r', 'd'] as const,
	rotate: ['l', 'u', 'r', 'd'] as const,
	box: ['l', 'u', 'r', 'd'] as const,
	orbit: ['l', 'u', 'r', 'd'] as const,
	pan: ['l', 'u', 'r', 'd'] as const,
	// p15 (Office 2013+) preset transitions: only the eight `P15_INVX_PRESETS`
	// (see `p15-transition-parser`) have an effect-options axis at all, and it
	// is a two-state `invX` toggle mapped onto `l`/`r` (curtains/prestige/
	// fracture/crush have no direction axis in PowerPoint at all).
	fallOver: ['l', 'r'] as const,
	drape: ['l', 'r'] as const,
	wind: ['l', 'r'] as const,
	peelOff: ['l', 'r'] as const,
	pageCurlSingle: ['l', 'r'] as const,
	pageCurlDouble: ['l', 'r'] as const,
	airplane: ['l', 'r'] as const,
	origami: ['l', 'r'] as const,
};

/**
 * Transition types offering a "Pattern" effect option alongside direction
 * (COM-verified via `p14:glitter/@pattern` and `p14:shred/@pattern`).
 */
export const TRANSITION_PATTERN_OPTIONS: Readonly<
	Partial<Record<PptxTransitionType, readonly string[]>>
> = {
	glitter: ['diamond', 'hexagon'] as const,
	shred: ['strip', 'rectangle'] as const,
};

/**
 * Transition types offering the "Through Black" checkbox
 * (OOXML `@_thruBlk`, `CT_OptionalBlackTransition`). COM-verified: enumerating
 * every `PpEntryEffect` constant found a dedicated black variant only for
 * `Cut` (`ppEffectCutThroughBlack`) and the legacy `Fade` entry (`ppEffectFade`,
 * as opposed to the newer non-black `ppEffectFadeSmoothly`); no Blinds/
 * Checkerboard "through black" `PpEntryEffect` constant exists despite the
 * `thruBlk` attribute being generically parseable off any standard transition
 * child.
 */
export const TRANSITION_THRUBLK_TYPES: ReadonlySet<PptxTransitionType> =
	new Set<PptxTransitionType>(['cut', 'fade']);

/**
 * Slide transition configuration.
 *
 * @example
 * ```ts
 * const transition: PptxSlideTransition = {
 *   type: "fade",
 *   durationMs: 700,
 *   advanceOnClick: true,
 *   advanceAfterMs: 5000,
 * };
 * // => { type: "fade", durationMs: 700, advanceOnClick: true, advanceAfterMs: 5000 }
 * ```
 */
/**
 * Morph granularity (`<p159:morph @option>`).
 *
 * - `byObject`  - match whole shapes (PowerPoint's default)
 * - `byWord`    - additionally morph text word by word
 * - `byChar`    - additionally morph text character by character
 */
export type PptxMorphOption = 'byObject' | 'byWord' | 'byChar';

export interface PptxSlideTransition {
	type: PptxTransitionType;
	/** Schema-defined transition speed. Defaults to `fast` when omitted. */
	speed?: PptxTransitionSpeed;
	durationMs?: number;
	direction?: string;
	advanceOnClick?: boolean;
	advanceAfterMs?: number;
	/** Number of spokes for wheel transition (1-8). */
	spokes?: number;
	/** Pattern type for shred transition. */
	pattern?: string;
	/**
	 * Through-black flag (OOXML `@_thruBlk`). COM-verified to actually apply to
	 * `cut` and `fade` (see {@link TRANSITION_THRUBLK_TYPES}); parsed generically
	 * off any standard transition child so an unexpected authored value still
	 * round-trips.
	 */
	thruBlk?: boolean;
	/** Split orientation (horz/vert) parsed from `@_orient`. */
	orient?: PptxSplitOrientation;
	/**
	 * Morph granularity from `<p159:morph @option>`: how finely PowerPoint
	 * matches content between the two slides. Only meaningful when
	 * {@link type} is `morph`; defaults to `byObject` when the attribute is
	 * absent, matching PowerPoint's own default.
	 */
	morphOption?: PptxMorphOption;
	/** Relationship ID of transition sound from `p:sndAc/p:stSnd/@r:embed` when present. */
	soundRId?: string;
	/** Embedded WAV display name from `p:stSnd/p:snd/@name`. */
	soundName?: string;
	/** Whether the transition sound repeats until another sound starts. */
	soundLoop?: boolean;
	/** Resolved transition sound media path within the package. */
	soundPath?: string;
	/** Human-readable sound file name (extracted from soundPath, or set by the
	 * UI when a new file is picked, before it has a soundPath at all). */
	soundFileName?: string;
	/**
	 * A newly-picked local sound file awaiting embedding, as a `data:` URL.
	 * Set by the transitions ribbon's Sound picker (`applyTransitionSoundFile`
	 * in `pptx-viewer-shared`) when the user chooses a file that is not yet
	 * part of the package; mirrors `imageData`/`mediaData` on picture and media
	 * elements. The save pipeline (`embedTransitionSound`) writes the bytes to
	 * `ppt/media/`, mints a relationship, sets `soundRId`/`soundPath`, and
	 * clears this field so a later save does not re-embed the same bytes.
	 */
	soundData?: string;
	/**
	 * When true, the transition stops the currently-playing sound (OOXML `p:sndAc/p:endSnd`).
	 * Mutually exclusive with `soundRId`/`soundPath` (which use `p:stSnd`).
	 */
	stopSound?: boolean;
	/** Preserved sound-action XML node from `p:sndAc` for lossless round-trip. */
	rawSoundAction?: XmlObject;
	/** Preserved extension-list XML node from `p:extLst` within the transition for lossless round-trip. */
	rawExtLst?: XmlObject;
	/** Original transition node, retained to preserve unknown attributes and children. */
	rawTransition?: XmlObject;
}
