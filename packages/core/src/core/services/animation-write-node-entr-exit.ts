/**
 * Behaviour children for one entrance/exit effect in the full-rebuild
 * writer: PowerPoint's captured tree for the preset and subtype when one
 * exists (complete, visibility toggles included), otherwise the historic
 * visibility-set + fade placeholder for a token PowerPoint has no preset for.
 * Split out of `animation-write-node-effect.ts` to keep it under the file
 * size guideline.
 *
 * @module services/animation-write-node-entr-exit
 */
import type { PptxElementAnimation, XmlObject } from '../types';
import { getAnimationBehaviorNodes } from './animation-behavior-table';
import { buildAnimEffectNode, buildVisibilitySet } from './animation-write-node-behaviors';

/** What the effect `p:cTn` needs from its entrance/exit behaviour tree. */
export interface EntranceExitChildren {
	children: XmlObject[];
	/** The presetSubtype actually written (an unknown request falls back to the default). */
	presetSubtype: number;
	accel: number;
	decel: number;
	/** The preset's default `p:iterate`, when PowerPoint writes one. */
	iterate?: { type: string; tmPct?: number };
}

/**
 * Build the `p:childTnLst` behaviours for an entrance/exit effect.
 * `accel`/`decel` come in as the author's timing-curve choice; when the
 * author chose none, PowerPoint's own curve for the preset (Swish's accel,
 * Spinner's decel...) replaces them.
 */
export function buildEntranceExitChildren(
	anim: PptxElementAnimation,
	presetClass: 'entr' | 'exit',
	presetId: number,
	presetSubtype: number,
	durationMs: number,
	curve: { accel: number; decel: number },
	allocateId: () => number,
): EntranceExitChildren {
	const shapeId = anim.elementId;
	const real = getAnimationBehaviorNodes(
		presetClass,
		presetId,
		presetSubtype,
		shapeId,
		durationMs,
		allocateId,
	);
	if (!real) {
		const children: XmlObject[] = [];
		if (presetClass === 'entr') {
			children.push(buildVisibilitySet(shapeId, durationMs, true, allocateId));
		}
		children.push(
			buildAnimEffectNode(shapeId, durationMs, presetClass === 'entr' ? 'in' : 'out', allocateId),
		);
		if (presetClass === 'exit') {
			children.push(buildVisibilitySet(shapeId, durationMs, false, allocateId));
		}
		return { children, presetSubtype, ...curve };
	}
	const useDefaultCurve = anim.timingCurve === undefined;
	return {
		children: real.nodes,
		presetSubtype: real.presetSubtype ?? presetSubtype,
		accel:
			useDefaultCurve && real.effectAccel !== undefined ? Number(real.effectAccel) : curve.accel,
		decel:
			useDefaultCurve && real.effectDecel !== undefined ? Number(real.effectDecel) : curve.decel,
		iterate: real.iterate,
	};
}
