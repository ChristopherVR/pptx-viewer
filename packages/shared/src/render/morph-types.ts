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
}

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

/** Maximum pixel distance for proximity-based element matching. */
export const PROXIMITY_THRESHOLD = 300;
