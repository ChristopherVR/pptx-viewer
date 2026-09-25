/**
 * Full-rebuild single-effect (p:par) node assembly for the OOXML animation
 * write service. Extracted from `animation-write-node-builders` to keep
 * file sizes manageable.
 */
import type { PptxAnimationPreset, PptxElementAnimation, XmlObject } from '../types';
import { applyAfterAnimationBehavior } from './animation-after-effect-write';
import { getCapturedPreset } from './animation-behavior-captured';
import { getAnimationBehaviorNodes } from './animation-behavior-table';
import { groupBehaviorChildren } from './animation-write-child-groups';
import { applyEffectCTnExtras, buildRepeatAttrs } from './animation-write-effect-extras';
import {
	resolveOoxmlPresetMapping,
	DIRECTION_TO_SUBTYPE,
	triggerToNodeType,
	timingCurveToAccelDecel,
} from './animation-write-mappings';
import {
	buildAnimEffectNode,
	buildAnimPropertyNode,
	buildAnimRotNode,
	buildAnimScaleNode,
	applySoundToEffectCTn,
	ROTATION_EMPHASIS,
	SCALE_EMPHASIS,
	OPACITY_EMPHASIS,
} from './animation-write-node-behaviors';
import { buildEntranceExitChildren } from './animation-write-node-entr-exit';

/**
 * Build behavior nodes specific to emphasis effects.
 * Returns the appropriate OOXML behavior node(s) for the given emphasis preset.
 */
export function buildEmphasisBehaviorNodes(
	shapeId: string,
	duration: number,
	preset: PptxAnimationPreset,
	allocateId: () => number,
	presetId: number,
	presetSubtype: number,
): XmlObject[] {
	const real = getAnimationBehaviorNodes(
		'emph',
		presetId,
		presetSubtype,
		shapeId,
		duration,
		allocateId,
	);
	if (real) {
		return real.nodes;
	}
	if (ROTATION_EMPHASIS.has(preset)) {
		return [buildAnimRotNode(shapeId, duration, preset, allocateId)];
	}
	if (SCALE_EMPHASIS.has(preset)) {
		return [buildAnimScaleNode(shapeId, duration, allocateId)];
	}
	if (OPACITY_EMPHASIS.has(preset)) {
		return [buildAnimPropertyNode(shapeId, duration, 'style.opacity', allocateId)];
	}
	// Default emphasis: pulse, wave, bounce, colorWave -- use p:animEffect
	return [buildAnimEffectNode(shapeId, duration, 'in', allocateId)];
}

/**
 * Build a single effect p:par node containing the OOXML animation
 * elements (p:animEffect, p:set, p:anim, p:animRot, p:animScale, etc.).
 */
export function buildSingleEffectNode(
	anim: PptxElementAnimation,
	preset: PptxAnimationPreset,
	presetClass: 'entr' | 'exit' | 'emph',
	allocateId: () => number,
): XmlObject | undefined {
	const mapping = resolveOoxmlPresetMapping(
		preset,
		(cls, id) => getCapturedPreset(cls, id)?.defaultSubtype,
	);
	if (!mapping || mapping.presetClass === 'path') {
		return undefined;
	}

	const duration = anim.durationMs ?? 500;
	const delay = anim.delayMs ?? 0;
	const trigger = anim.trigger ?? 'onClick';
	const nodeType = triggerToNodeType(trigger);
	let { accel, decel } = timingCurveToAccelDecel(anim.timingCurve);
	let subtype = anim.direction
		? (DIRECTION_TO_SUBTYPE[anim.direction] ?? mapping.defaultSubtype)
		: mapping.defaultSubtype;

	const effectId = allocateId();
	const shapeId = anim.elementId;

	let childElements: XmlObject[] = [];
	let presetIterate: { type: string; tmPct?: number } | undefined;

	if (presetClass === 'emph') {
		childElements = buildEmphasisBehaviorNodes(
			shapeId,
			duration,
			preset,
			allocateId,
			mapping.presetId,
			subtype,
		);
	} else {
		const built = buildEntranceExitChildren(
			anim,
			presetClass,
			mapping.presetId,
			subtype,
			duration,
			{ accel, decel },
			allocateId,
		);
		childElements = built.children;
		subtype = built.presetSubtype;
		accel = built.accel;
		decel = built.decel;
		presetIterate = built.iterate;
	}

	const repeatAttrs = buildRepeatAttrs(anim);

	const effectCTn: XmlObject = {
		'@_id': String(effectId),
		'@_presetID': String(mapping.presetId),
		'@_presetClass': presetClass,
		'@_presetSubtype': String(subtype),
		'@_fill': 'hold',
		'@_nodeType': nodeType,
		'@_dur': String(duration),
		...repeatAttrs,
		'p:stCondLst': {
			'p:cond': {
				'@_delay': String(delay),
			},
		},
		'p:childTnLst': {},
	};

	if (accel > 0) {
		effectCTn['@_accel'] = String(accel);
	}
	if (decel > 0) {
		effectCTn['@_decel'] = String(decel);
	}

	effectCTn['p:childTnLst'] = groupBehaviorChildren(childElements);

	// "After animation" describes what happens once an entrance/emphasis
	// effect finishes; an exit effect already ends by hiding, so it never
	// gets one (mirrors the exit skip in `applyAfterAnimationFromEditorList`).
	// Runs BEFORE the sound step: it deletes and rebuilds `p:subTnLst` from
	// scratch, which would erase a sound entry written first.
	if (presetClass !== 'exit') {
		applyAfterAnimationBehavior(effectCTn, anim, shapeId);
	}
	applySoundToEffectCTn(effectCTn, anim);
	// A preset PowerPoint authors letter by letter (Color Typewriter, Swish,
	// Whip...) keeps that default unless the author picked a sequence.
	if (presetIterate && anim.sequence === undefined) {
		effectCTn['p:iterate'] = {
			'@_type': presetIterate.type,
			...(presetIterate.tmPct !== undefined
				? { 'p:tmPct': { '@_val': String(presetIterate.tmPct) } }
				: {}),
		};
	}
	applyEffectCTnExtras(effectCTn, anim);

	const wrapperId = allocateId();
	return {
		'p:cTn': {
			'@_id': String(wrapperId),
			'@_fill': 'hold',
			'p:stCondLst': {
				'p:cond': {
					'@_delay': trigger === 'withPrevious' ? '0' : String(delay),
				},
			},
			'p:childTnLst': {
				'p:par': {
					'p:cTn': effectCTn,
				},
			},
		},
	} as XmlObject;
}
