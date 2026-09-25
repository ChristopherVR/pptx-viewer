/**
 * Keep an existing effect's behaviour tree in step with the editor entry the
 * surgical writer patches it from (see `animation-timing-surgical`).
 *
 * The surgical path used to rewrite only the effect's attributes: switching
 * a Wipe from "From Bottom" to "From Left" saved `presetSubtype="8"` over a
 * `wipe(down)` filter, a preset change left the old preset's behaviours
 * under the new `presetID`, a new duration left every behaviour on its old
 * clock, and a new timing curve was never written at all. PowerPoint plays
 * the behaviours, so the reopened deck kept the old animation.
 *
 * Now a change of preset or direction rebuilds the behaviours from
 * PowerPoint's captured tree for the new `(preset, subtype)`, a duration
 * change rescales every behaviour's own `dur`/`delay`, and an explicit
 * timing curve lands on the effect's `accel`/`decel`. An entry that changes
 * none of those leaves the deck's tree exactly as authored.
 *
 * @module services/animation-timing-surgical-behaviors
 */
import type { PptxAnimationPreset, PptxElementAnimation, XmlObject } from '../types';
import { getCapturedTree } from './animation-behavior-captured';
import { groupBehaviorChildren } from './animation-write-child-groups';
import type { OoxmlPresetMapping } from './animation-write-mappings';
import { DIRECTION_TO_SUBTYPE, timingCurveToAccelDecel } from './animation-write-mappings';
import { buildEmphasisBehaviorNodes } from './animation-write-node-effect';
import { buildEntranceExitChildren } from './animation-write-node-entr-exit';
import {
	extractChildBehaviourDurationMs,
	extractStartConditionDelayMs,
	readTimingAttr,
} from './native-animation-extended-helpers';
import { ensureArray, isXmlObject } from './native-animation-helpers';

/** Behaviour element names whose `p:cBhvr/p:cTn` carries the timing. */
const BEHAVIOUR_TAGS = [
	'p:set',
	'p:anim',
	'p:animEffect',
	'p:animClr',
	'p:animMotion',
	'p:animRot',
	'p:animScale',
] as const;

/**
 * The presetSubtype PowerPoint writes for `direction` on this preset: the
 * editor's direction when the preset has that variant, else the preset's
 * default (never a code PowerPoint would not write, like a diagonal Wipe).
 */
export function resolveDirectionSubtype(
	mapping: OoxmlPresetMapping,
	direction: PptxElementAnimation['direction'],
): number {
	const requested = direction ? DIRECTION_TO_SUBTYPE[direction] : undefined;
	if (mapping.presetClass === 'entr' || mapping.presetClass === 'exit') {
		const captured = getCapturedTree(mapping.presetClass, mapping.presetId, requested);
		if (captured) {
			return captured.subtype;
		}
	}
	return requested ?? mapping.defaultSubtype;
}

function readInt(raw: unknown): number | undefined {
	const parsed = Number.parseInt(String(raw ?? ''), 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/** The effect's current duration: its own `@dur`, else its behaviours' span. */
function currentDurationMs(cTn: XmlObject): number | undefined {
	return readTimingAttr(cTn['@_dur']) ?? extractChildBehaviourDurationMs(cTn, ensureArray);
}

/**
 * Scale every behaviour's `dur` and start `delay` by `ratio`. 1 ms toggles
 * keep their length, and one that closes the effect (an exit's final
 * visibility `p:set`) keeps closing it.
 */
function rescaleBehaviors(childTnLst: XmlObject, fromMs: number, toMs: number): void {
	const ratio = toMs / fromMs;
	for (const tag of BEHAVIOUR_TAGS) {
		for (const behaviour of ensureArray(childTnLst[tag])) {
			const inner = (behaviour['p:cBhvr'] as XmlObject | undefined)?.['p:cTn'];
			if (!isXmlObject(inner)) {
				continue;
			}
			const dur = readTimingAttr(inner['@_dur']);
			const delay = extractStartConditionDelayMs(inner);
			const closesEffect = dur !== undefined && delay !== undefined && delay + dur === fromMs;
			if (dur !== undefined && dur > 1) {
				inner['@_dur'] = String(Math.max(1, Math.round(dur * ratio)));
			}
			if (delay === undefined) {
				continue;
			}
			const scaled = closesEffect ? toMs - (dur ?? 0) : Math.round(delay * ratio);
			const stCondLst = inner['p:stCondLst'];
			if (isXmlObject(stCondLst)) {
				for (const cond of ensureArray(stCondLst['p:cond'])) {
					if (readTimingAttr(cond['@_delay']) === delay) {
						cond['@_delay'] = String(scaled);
					}
				}
			}
		}
	}
}

function setCurve(cTn: XmlObject, accel: number, decel: number): void {
	if (accel > 0) {
		cTn['@_accel'] = String(accel);
	} else {
		delete cTn['@_accel'];
	}
	if (decel > 0) {
		cTn['@_decel'] = String(decel);
	} else {
		delete cTn['@_decel'];
	}
}

/**
 * Bring `cTn`'s behaviours in line with `anim` BEFORE its attributes are
 * patched (it reads the node's current `presetID`/`presetSubtype`/duration).
 * Writes `@presetSubtype` itself: the subtype PowerPoint would write.
 */
export function refreshEffectBehaviors(
	cTn: XmlObject,
	anim: PptxElementAnimation,
	preset: PptxAnimationPreset,
	mapping: OoxmlPresetMapping,
	shapeId: string,
	allocateId: () => number,
): void {
	const subtype = resolveDirectionSubtype(mapping, anim.direction);
	const oldId = readInt(cTn['@_presetID']);
	const oldSubtype = readInt(cTn['@_presetSubtype']);
	const oldDuration = currentDurationMs(cTn);
	const duration = anim.durationMs ?? oldDuration ?? 500;
	const presetChanged = oldId !== mapping.presetId;
	const curve = timingCurveToAccelDecel(anim.timingCurve);

	if (
		(mapping.presetClass === 'entr' || mapping.presetClass === 'exit') &&
		(presetChanged || oldSubtype !== subtype)
	) {
		const built = buildEntranceExitChildren(
			{ ...anim, elementId: shapeId },
			mapping.presetClass,
			mapping.presetId,
			subtype,
			duration,
			curve,
			allocateId,
		);
		cTn['p:childTnLst'] = groupBehaviorChildren(built.children);
		cTn['@_presetSubtype'] = String(built.presetSubtype);
		setCurve(cTn, built.accel, built.decel);
		return;
	}
	if (mapping.presetClass === 'emph' && presetChanged) {
		const children = buildEmphasisBehaviorNodes(
			shapeId,
			duration,
			preset,
			allocateId,
			mapping.presetId,
			subtype,
		);
		cTn['p:childTnLst'] = groupBehaviorChildren(children);
		cTn['@_presetSubtype'] = String(subtype);
	} else {
		cTn['@_presetSubtype'] = String(subtype);
		const childTnLst = cTn['p:childTnLst'];
		if (
			anim.durationMs !== undefined &&
			oldDuration !== undefined &&
			oldDuration > 0 &&
			oldDuration !== anim.durationMs &&
			isXmlObject(childTnLst)
		) {
			rescaleBehaviors(childTnLst, oldDuration, anim.durationMs);
		}
	}
	if (anim.timingCurve !== undefined) {
		setCurve(cTn, curve.accel, curve.decel);
	}
}
