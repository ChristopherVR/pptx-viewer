/**
 * Full-rebuild single-effect (p:par) node assembly for the OOXML animation
 * write service. Extracted from `animation-write-node-builders` to keep
 * file sizes manageable.
 */
import type { PptxAnimationPreset, PptxElementAnimation, XmlObject } from '../types';
import { applyAfterAnimationBehavior } from './animation-after-effect-write';
import {
	PRESET_TO_OOXML,
	DIRECTION_TO_SUBTYPE,
	triggerToNodeType,
	timingCurveToAccelDecel,
} from './animation-write-mappings';
import {
	buildAnimEffectNode,
	buildAnimPropertyNode,
	buildAnimRotNode,
	buildAnimScaleNode,
	buildVisibilitySet,
	applySoundToEffectCTn,
	ROTATION_EMPHASIS,
	SCALE_EMPHASIS,
	OPACITY_EMPHASIS,
} from './animation-write-node-behaviors';

/**
 * Build behavior nodes specific to emphasis effects.
 * Returns the appropriate OOXML behavior node(s) for the given emphasis preset.
 */
function buildEmphasisBehaviorNodes(
	shapeId: string,
	duration: number,
	preset: PptxAnimationPreset,
	allocateId: () => number,
): XmlObject[] {
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
	const mapping = PRESET_TO_OOXML[preset];
	if (!mapping) {
		return undefined;
	}

	const duration = anim.durationMs ?? 500;
	const delay = anim.delayMs ?? 0;
	const trigger = anim.trigger ?? 'onClick';
	const nodeType = triggerToNodeType(trigger);
	const { accel, decel } = timingCurveToAccelDecel(anim.timingCurve);
	const subtype = anim.direction
		? (DIRECTION_TO_SUBTYPE[anim.direction] ?? mapping.defaultSubtype)
		: mapping.defaultSubtype;

	const effectId = allocateId();
	const shapeId = anim.elementId;

	const childElements: XmlObject[] = [];

	if (presetClass === 'entr') {
		childElements.push(buildVisibilitySet(shapeId, duration, true, allocateId));
	}

	if (presetClass === 'emph') {
		const emphNodes = buildEmphasisBehaviorNodes(shapeId, duration, preset, allocateId);
		for (const n of emphNodes) {
			childElements.push(n);
		}
	} else {
		const animEffectNode = buildAnimEffectNode(
			shapeId,
			duration,
			presetClass === 'entr' ? 'in' : 'out',
			allocateId,
		);
		childElements.push(animEffectNode);
	}

	if (presetClass === 'exit') {
		childElements.push(buildVisibilitySet(shapeId, duration, false, allocateId));
	}

	const repeatAttrs: Record<string, string> = {};
	if (anim.repeatCount && anim.repeatCount > 1) {
		repeatAttrs['@_repeatCount'] = String(anim.repeatCount * 1000);
	}
	if (anim.repeatMode === 'untilNextClick') {
		repeatAttrs['@_repeatCount'] = 'indefinite';
		repeatAttrs['@_restart'] = 'whenNotActive';
	} else if (anim.repeatMode === 'untilEndOfSlide') {
		repeatAttrs['@_repeatCount'] = 'indefinite';
	}

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

	const childTnLst: XmlObject = {};
	const setNodes: XmlObject[] = [];
	const animEffectNodes: XmlObject[] = [];
	const animNodes: XmlObject[] = [];
	const animRotNodes: XmlObject[] = [];
	const animScaleNodes: XmlObject[] = [];

	for (const child of childElements) {
		const childNodeType = child['_type'] as string | undefined;
		delete child['_type'];
		switch (childNodeType) {
			case 'set':
				setNodes.push(child);
				break;
			case 'animEffect':
				animEffectNodes.push(child);
				break;
			case 'anim':
				animNodes.push(child);
				break;
			case 'animRot':
				animRotNodes.push(child);
				break;
			case 'animScale':
				animScaleNodes.push(child);
				break;
			default:
				animEffectNodes.push(child);
				break;
		}
	}

	if (setNodes.length > 0) {
		childTnLst['p:set'] = setNodes.length === 1 ? setNodes[0] : setNodes;
	}
	if (animEffectNodes.length > 0) {
		childTnLst['p:animEffect'] =
			animEffectNodes.length === 1 ? animEffectNodes[0] : animEffectNodes;
	}
	if (animNodes.length > 0) {
		childTnLst['p:anim'] = animNodes.length === 1 ? animNodes[0] : animNodes;
	}
	if (animRotNodes.length > 0) {
		childTnLst['p:animRot'] = animRotNodes.length === 1 ? animRotNodes[0] : animRotNodes;
	}
	if (animScaleNodes.length > 0) {
		childTnLst['p:animScale'] = animScaleNodes.length === 1 ? animScaleNodes[0] : animScaleNodes;
	}

	effectCTn['p:childTnLst'] = childTnLst;

	applySoundToEffectCTn(effectCTn, anim);
	// "After animation" describes what happens once an entrance/emphasis
	// effect finishes; an exit effect already ends by hiding, so it never
	// gets one (mirrors the exit skip in `applyAfterAnimationFromEditorList`).
	if (presetClass !== 'exit') {
		applyAfterAnimationBehavior(effectCTn, anim, shapeId);
	}

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
