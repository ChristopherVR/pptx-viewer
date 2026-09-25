/**
 * Composer + lookup for the COM-derived "real PowerPoint behaviour tree"
 * preset tables. `animation-write-node-effect.ts` calls
 * {@link getAnimationBehaviorNodes} for every entrance/exit/emphasis effect
 * it serialises; when it returns nodes, the writer emits PowerPoint's real
 * choreography (filter, motion, scale, rotation, colour) instead of a
 * placeholder. `undefined` means this id has no PowerPoint tree and the
 * caller keeps its own fallback.
 *
 * Entrance/exit trees come from `animation-behavior-captured.ts`: PowerPoint's
 * saved tree for every real preset id AND every presetSubtype it accepts, so
 * a directional preset (Wipe from left, Split horizontal out, Fly from top
 * right...) writes the tree PowerPoint writes for that direction. Emphasis
 * keeps its dedicated per-preset tables.
 *
 * METHODOLOGY (every table this module composes): a blank rectangle on a
 * blank slide, `Slide.TimeLine.MainSequence.AddEffect(shape, <MsoAnimEffect>,
 * msoAnimateLevelNone, msoAnimTriggerOnPageClick)`, optionally
 * `Effect.EffectParameters.Direction = <MsoAnimDirection>` and
 * `Effect.Exit = True`, `Presentation.SaveAs` to `.pptx`, then reading the
 * saved slide XML for the effect's own `p:cTn` subtree.
 *
 * @module services/animation-behavior-table
 */
import type { XmlObject } from '../types';
import { getCapturedTree } from './animation-behavior-captured';
import { buildCapturedBehaviorNodes } from './animation-behavior-captured-xml';
import { getRichEmphasisTemplate } from './animation-behavior-emphasis-rich';
import { getSimpleEmphasisTemplate } from './animation-behavior-emphasis-simple';
import { buildBehaviorNodes } from './animation-behavior-node-builders';
import type {
	AnimBehaviorNodeSpec,
	AnimationBehaviorTemplate,
} from './animation-behavior-node-types';

/** Multiply every fractional timing field in a template's nodes by `durationMs`. */
function resolveTemplate(
	template: AnimationBehaviorTemplate,
	durationMs: number,
): ReadonlyArray<AnimBehaviorNodeSpec> {
	return template.nodes.map((node) => ({
		...node,
		durMs: node.durMs * durationMs,
		delayMs: node.delayMs !== undefined ? node.delayMs * durationMs : undefined,
	}));
}

/**
 * Result of looking up a preset's real behaviour tree: `nodes` replace the
 * default single `p:animEffect` for this effect's movement/emphasis content
 * (the caller still owns the surrounding visibility `p:set` and effect
 * `p:cTn` wrapper, which are identical across every preset).
 */
export interface AnimationBehaviorNodesResult {
	nodes: XmlObject[];
	/** The presetSubtype the tree belongs to (an unknown request falls back to the default). */
	presetSubtype?: number;
	/** Effect-level `accel`/`decel` PowerPoint writes for the preset, as raw attribute strings. */
	effectAccel?: string;
	effectDecel?: string;
	/** The preset's default `p:iterate` (`type` + `tmPct`). */
	iterate?: { type: string; tmPct?: number };
}

/**
 * Look up and build the real PowerPoint behaviour-tree nodes for one
 * `(presetClass, presetId)` (and, for directional presets, `presetSubtype`).
 * Returns `undefined` when this id has no PowerPoint tree.
 */
export function getAnimationBehaviorNodes(
	presetClass: 'entr' | 'exit' | 'emph',
	presetId: number,
	presetSubtype: number,
	shapeId: string,
	durationMs: number,
	allocateId: () => number,
): AnimationBehaviorNodesResult | undefined {
	if (presetClass === 'emph') {
		const template = getSimpleEmphasisTemplate(presetId) ?? getRichEmphasisTemplate(presetId);
		if (!template) {
			return undefined;
		}
		return {
			nodes: buildBehaviorNodes(resolveTemplate(template, durationMs), shapeId, allocateId),
		};
	}
	const captured = getCapturedTree(presetClass, presetId, presetSubtype);
	if (!captured) {
		return undefined;
	}
	return {
		nodes: buildCapturedBehaviorNodes(captured.nodes, shapeId, durationMs, allocateId),
		presetSubtype: captured.subtype,
		effectAccel: captured.preset.effect?.accel,
		effectDecel: captured.preset.effect?.decel,
		iterate: captured.preset.iterate,
	};
}
