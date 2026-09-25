/**
 * PowerPoint's own behaviour tree for every entrance/exit preset id and
 * presetSubtype, captured from retail PowerPoint (see
 * `scripts/generate-animation-behavior-captures.mjs`, which writes
 * `animation-behavior-captures.json`, and
 * `scripts/capture-animation-behaviors.ps1`, which produces its input decks).
 *
 * METHOD: for every `MsoAnimEffect` 1..82 and every `MsoAnimDirection` the
 * effect accepts, a blank rectangle got `MainSequence.AddEffect(shape,
 * effect)` (plus `Effect.Exit = True` for the exit pass) and the saved
 * slide XML was read back. That yields 196 entrance and 196 exit variants
 * over the 52 real preset ids. Each tree keeps PowerPoint's relative timing
 * (every `dur`/`delay` is a fraction of the preset's default duration) so
 * it scales to whatever speed the author picks.
 *
 * This module is data access only; `animation-behavior-captured-xml.ts`
 * turns a tree into writer nodes.
 *
 * @module services/animation-behavior-captured
 */
import captures from './animation-behavior-captures.json';

/** A typed OOXML value (`p:strVal` / `p:fltVal` / ... / `p:clrVal`). */
export interface CapturedValue {
	t: 'str' | 'flt' | 'int' | 'bool' | 'clr';
	v: string;
	/** Colour element name for `t: 'clr'` (`schemeClr`, `srgbClr`). */
	kind?: string;
}

/** One `p:tav` stop. */
export interface CapturedTav {
	tm: string;
	fmla?: string;
	val?: CapturedValue;
}

/** One behaviour child of an effect's `p:childTnLst`, as PowerPoint wrote it. */
export interface CapturedBehaviorNode {
	tag: 'set' | 'anim' | 'animEffect' | 'animScale' | 'animRot' | 'animMotion' | 'animClr';
	/** Duration as a fraction of the preset duration. */
	dur?: number;
	/** Absolute duration in ms (PowerPoint's 1 ms discrete toggles). */
	absDurMs?: number;
	/** Start offset as a fraction of the preset duration. */
	delay?: number;
	/** Start offset measured back from the effect's end (an exit's closing 1 ms toggle). */
	delayFromEndMs?: number;
	/** Remaining `p:cTn` attributes (`fill`, `accel`, `decel`, `autoRev`, `tmFilter`...). */
	ctn?: Record<string, string>;
	/** `p:cBhvr` attributes (`additive`, `override`...). */
	bhvr?: Record<string, string>;
	/** `p:attrNameLst` entries. */
	names?: string[];
	/** The behaviour element's own attributes (`filter`, `from`, `by`, `path`...). */
	attrs?: Record<string, string>;
	/** `p:set/p:to`. */
	setTo?: CapturedValue;
	/** `p:animEffect/p:progress`. */
	progress?: CapturedValue;
	tav?: CapturedTav[];
	/** `p:animScale` / `p:animMotion` `from`/`to`/`by` points. */
	scale?: Partial<Record<'from' | 'to' | 'by', [string, string]>>;
}

/** One preset id's capture: its trees and which subtype uses which tree. */
export interface CapturedPreset {
	/** PowerPoint's default duration for the preset (what "fraction 1" means). */
	durMs: number;
	/** The subtype `AddEffect` picks when no direction is set. */
	defaultSubtype: number;
	/** Effect-level `accel`/`decel` PowerPoint writes on the preset's own `p:cTn`. */
	effect?: { accel?: string; decel?: string };
	/** The preset's default `p:iterate` (e.g. Color Typewriter animates by letter). */
	iterate?: { type: string; tmPct?: number };
	trees: CapturedBehaviorNode[][];
	/** presetSubtype -> index into `trees`. */
	subtypes: Record<string, number>;
}

interface CapturedTable {
	entr: Record<string, CapturedPreset>;
	exit: Record<string, CapturedPreset>;
}

const TABLE = captures as unknown as CapturedTable;

/** The captured preset for an entrance/exit id, or `undefined` when PowerPoint has none. */
export function getCapturedPreset(
	presetClass: 'entr' | 'exit',
	presetId: number,
): CapturedPreset | undefined {
	return TABLE[presetClass][String(presetId)];
}

/** Every captured preset id for a class, ascending. */
export function capturedPresetIds(presetClass: 'entr' | 'exit'): number[] {
	return Object.keys(TABLE[presetClass])
		.map(Number)
		.sort((a, b) => a - b);
}

/** The presetSubtypes PowerPoint accepted for a preset, in capture order. */
export function capturedSubtypes(presetClass: 'entr' | 'exit', presetId: number): number[] {
	const preset = getCapturedPreset(presetClass, presetId);
	return preset ? Object.keys(preset.subtypes).map(Number) : [];
}

/**
 * The tree PowerPoint writes for `(class, id, subtype)`. An unknown subtype
 * falls back to the preset's default subtype, never to a different preset.
 */
export function getCapturedTree(
	presetClass: 'entr' | 'exit',
	presetId: number,
	presetSubtype: number | undefined,
): { preset: CapturedPreset; subtype: number; nodes: CapturedBehaviorNode[] } | undefined {
	const preset = getCapturedPreset(presetClass, presetId);
	if (!preset) {
		return undefined;
	}
	const requested =
		presetSubtype !== undefined ? preset.subtypes[String(presetSubtype)] : undefined;
	const subtype = requested !== undefined ? (presetSubtype as number) : preset.defaultSubtype;
	const index = preset.subtypes[String(subtype)];
	const nodes = index !== undefined ? preset.trees[index] : undefined;
	return nodes ? { preset, subtype, nodes } : undefined;
}
