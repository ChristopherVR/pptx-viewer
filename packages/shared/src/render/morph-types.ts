/**
 * Types, interfaces, and constants for the PowerPoint Morph transition system.
 *
 * Pure, framework-agnostic. Consumed by every binding; bindings keep only the
 * DOM/RAF animation driver.
 *
 * @module render/morph-types
 */
import type { PptxElement } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A matched pair of elements between the outgoing and incoming slides. */
export interface MorphPair {
	fromElement: PptxElement;
	toElement: PptxElement;
}

/** Result from full morph matching including unmatched elements. */
export interface MorphMatchResult {
	/** Matched element pairs to animate between. */
	pairs: MorphPair[];
	/** Element IDs only present on the outgoing (from) slide — these fade out. */
	unmatchedFrom: PptxElement[];
	/** Element IDs only present on the incoming (to) slide — these fade in. */
	unmatchedTo: PptxElement[];
}

/** Describes the CSS animation and keyframes for a single morph-animated element. */
export interface MorphAnimationStyle {
	elementId: string;
	/** CSS animation string. */
	animation: string;
	/** Inline keyframes block to inject. */
	keyframes: string;
	/**
	 * Which node inside the element the animation belongs on.
	 *
	 * `element` (the default) is the element's own positioned container, the
	 * node that carries its static transform. `image` is the `<img>` INSIDE
	 * that container, which every binding renders for a picture: a source crop
	 * (`a:srcRect`) is painted by transforming the img within its frame, so
	 * morphing a crop change has to animate that node and not the frame - the
	 * frame is usually exactly the same size on both slides (issue #148).
	 */
	target?: MorphAnimationTarget;
}

/** @see MorphAnimationStyle.target */
export type MorphAnimationTarget = 'element' | 'image';

/** Morph granularity mode matching PowerPoint's morph effect options. */
export type MorphMode = 'object' | 'word' | 'character';

/** A single token (word or character) with its computed position for text morphing. */
export interface MorphTextToken {
	text: string;
	/** Normalised x offset within the text frame (0-1). */
	x: number;
	/** Normalised y offset within the text frame (0-1). */
	y: number;
	fontSize: number;
	fontWeight: string;
	color: string;
}

/** Paired tokens for text morph animation. */
export interface MorphTextTokenPair {
	from: MorphTextToken | null;
	to: MorphTextToken | null;
}

/** Parsed RGBA colour for interpolation. */
export interface RgbaColor {
	r: number;
	g: number;
	b: number;
	a: number;
}

/** A single SVG path command with its coordinate values. */
export interface SvgPathCommand {
	type: string;
	values: number[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PowerPoint's morph transition uses a specific cubic-bezier easing. */
export const MORPH_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

/**
 * The curve a matched pair DISSOLVES on, which is not the curve it travels on.
 *
 * Measured, not guessed: the issue #131 deck's hub-to-topic morph was exported
 * through PowerPoint's own `CreateVideo` and every one of the 59 frames of the
 * arriving title fitted to a blend of the first and last frame (residual under
 * 1/255, so the dissolve really is a plain linear blend). The alpha runs 0.035
 * at 7% of the duration, 0.232 at 20%, 0.477 at 34%, 0.684 at 47%, 0.888 at 68%
 * and 0.988 at 88%: an ease that leans in gently and then decelerates hard.
 * This curve tracks those samples to an RMS of 0.004 and never differs by more
 * than 0.009. {@link MORPH_EASING}, which the ghost used to fade on, sits at
 * 0.5 where PowerPoint is already at 0.73 (issue #146).
 */
export const MORPH_CROSSFADE_EASING = 'cubic-bezier(0.2, 0, 0.4, 1)';

/**
 * When an unmatched OUTGOING shape has finished dissolving, as a percentage of
 * the morph's duration, and when it starts.
 *
 * PowerPoint does not simply cross-fade the two slides over the whole
 * transition: a shape with no counterpart is gone well before its replacement
 * appears, so the middle of a morph shows neither. Measured on PowerPoint 16
 * with a two-slide deck whose only shape exists on the first slide (a 1s
 * morph, frames sampled ~25ms apart, alpha read off the pixels of a pure-red
 * rectangle over white): alpha 0.98 at 3ms, 0.88 at 64ms, 0.62 at 112ms, 0.29
 * at 175ms, 0.13 at 210ms, gone by 238ms. That is a LINEAR ramp from 35ms to
 * 235ms (fit RMS 0.024, better than any eased curve). The box never moves or
 * changes size across those frames, which is why nothing here scales.
 */
export const MORPH_FADE_OUT_HOLD_PERCENT = 4;
/** @see MORPH_FADE_OUT_HOLD_PERCENT */
export const MORPH_FADE_OUT_END_PERCENT = 23;

/**
 * When an unmatched INCOMING shape starts dissolving in, as a percentage of the
 * morph's duration, and the curve it follows from there to full opacity.
 *
 * Same measurement, with the shape only on the SECOND slide: nothing at all
 * until 401ms, then alpha 0.18 at 464ms, 0.48 at 561ms, 0.72 at 652ms, 0.90 at
 * 776ms, 0.99 at 935ms. Fitting start and duration jointly puts the ramp at
 * 425ms with a decelerating curve (`cubic-bezier(0, 0, 0.35, 1)`, fit RMS
 * 0.008); `linear` over the same window is 9x worse.
 */
export const MORPH_FADE_IN_START_PERCENT = 42;
/** @see MORPH_FADE_IN_START_PERCENT */
export const MORPH_FADE_IN_EASING = 'cubic-bezier(0, 0, 0.35, 1)';

/** Maximum pixel distance for proximity-based element matching. */
export const PROXIMITY_THRESHOLD = 300;

/**
 * Maximum per-axis size ratio (larger/smaller) for a proximity match. Pairs
 * further apart than this in width OR height dissolve in place instead of
 * gliding, because interpolating the box would visibly stretch one shape into
 * the other (issue #131: a centre-text group paired with a whole wheel wedge).
 */
export const PROXIMITY_SIZE_RATIO_LIMIT = 2;
