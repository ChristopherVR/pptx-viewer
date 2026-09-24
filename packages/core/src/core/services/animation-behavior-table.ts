/**
 * Composer + lookup for the COM-derived "real PowerPoint behaviour tree"
 * preset tables. `animation-write-node-effect.ts` calls
 * {@link getAnimationBehaviorNodes} for every entrance/exit/emphasis effect
 * it serialises; when it returns nodes, the writer emits PowerPoint's real
 * choreography (filter, motion, scale, rotation, colour) instead of the
 * historic "every preset writes `p:animEffect filter=\"fade\"`" placeholder.
 * `undefined` means this id isn't covered yet and the caller should keep
 * using its existing (pre-this-effort) fallback behaviour.
 *
 * METHODOLOGY (every table this module composes): a blank rectangle on a
 * blank slide, `Slide.TimeLine.MainSequence.AddEffect(shape, <MsoAnimEffect>,
 * msoAnimateLevelNone, msoAnimTriggerOnPageClick)`, optionally
 * `Effect.EffectParameters.Direction = <MsoAnimDirection>` for directional
 * presets and `Effect.Exit = True` for the exit mirror, `Presentation.SaveAs`
 * to `.pptx`, then reading the saved `ppt/slides/slide1.xml` directly (no
 * intermediate tooling) for the effect's own `p:cTn` subtree. See each
 * per-preset table's own module doc for the specific ids it covers and any
 * fidelity caveats.
 *
 * @module services/animation-behavior-table
 */
import type { XmlObject } from '../types';
import { getBounceTemplate } from './animation-behavior-bounce';
import { getRichEmphasisTemplate } from './animation-behavior-emphasis-rich';
import { getSimpleEmphasisTemplate } from './animation-behavior-emphasis-simple';
import { getFloatOrGrowTurnTemplate } from './animation-behavior-float-growturn';
import { getFlyBehaviorTemplate } from './animation-behavior-fly';
import { buildBehaviorNodes } from './animation-behavior-node-builders';
import type {
	AnimBehaviorNodeSpec,
	AnimationBehaviorTemplate,
} from './animation-behavior-node-types';
import { getSimpleFilterEntry } from './animation-behavior-simple-filters';

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
}

/**
 * Look up and build the real PowerPoint behaviour-tree nodes for one
 * `(presetClass, presetId)` (and, for directional presets, `presetSubtype`).
 * Returns `undefined` when this id has no dedicated template yet.
 */
export function getAnimationBehaviorNodes(
	presetClass: 'entr' | 'exit' | 'emph',
	presetId: number,
	presetSubtype: number,
	shapeId: string,
	durationMs: number,
	allocateId: () => number,
): AnimationBehaviorNodesResult | undefined {
	const template = lookUpTemplate(presetClass, presetId, presetSubtype);
	if (!template) {
		return undefined;
	}
	const resolved = resolveTemplate(template, durationMs);
	return { nodes: buildBehaviorNodes(resolved, shapeId, allocateId) };
}

function lookUpTemplate(
	presetClass: 'entr' | 'exit' | 'emph',
	presetId: number,
	presetSubtype: number,
): AnimationBehaviorTemplate | undefined {
	if (presetClass === 'emph') {
		return getSimpleEmphasisTemplate(presetId) ?? getRichEmphasisTemplate(presetId);
	}

	if (presetId === 2) {
		return getFlyBehaviorTemplate(presetClass, presetSubtype);
	}
	if (presetId === 26) {
		return getBounceTemplate(presetClass);
	}
	if (presetId === 30 || presetId === 31) {
		return getFloatOrGrowTurnTemplate(presetClass, presetId);
	}

	const simple = getSimpleFilterEntry(presetClass, presetId);
	if (!simple) {
		return undefined;
	}
	if (simple.noAnimEffect) {
		return { nodes: [], baselineDurationMs: 1 };
	}
	return {
		nodes: [
			{
				kind: 'animEffect',
				transition: presetClass === 'entr' ? 'in' : 'out',
				filter: simple.filter,
				durMs: 1,
			},
		],
		baselineDurationMs: 1,
	};
}
