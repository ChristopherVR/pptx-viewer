/**
 * Motion-path (p:animMotion) node assembly for the OOXML animation write
 * service. Extracted from `animation-write-node-builders` to keep file
 * sizes manageable.
 */
import type { PptxElementAnimation, XmlObject } from '../types';
import { triggerToNodeType, timingCurveToAccelDecel } from './animation-write-mappings';
import { applySoundToEffectCTn } from './animation-write-node-behaviors';

/**
 * Build a p:animMotion node for motion path animations.
 */
export function buildMotionPathNode(
	anim: PptxElementAnimation,
	allocateId: () => number,
): XmlObject | undefined {
	if (!anim.motionPath) {
		return undefined;
	}

	const duration = anim.durationMs ?? 1000;
	const delay = anim.delayMs ?? 0;
	const trigger = anim.trigger ?? 'onClick';
	const nodeType = triggerToNodeType(trigger);
	const { accel, decel } = timingCurveToAccelDecel(anim.timingCurve);

	const effectId = allocateId();
	const motionId = allocateId();

	const motionNode: XmlObject = {
		'@_origin': 'layout',
		'@_path': anim.motionPath,
		'@_pathEditMode': anim.motionPathEditMode ?? 'relative',
		'@_ptsTypes': anim.motionPtsTypes ?? '',
		'p:cBhvr': {
			'p:cTn': {
				'@_id': String(motionId),
				'@_dur': String(duration),
				'@_fill': 'hold',
			},
			'p:tgtEl': {
				'p:spTgt': {
					'@_spid': anim.elementId,
				},
			},
			'p:attrNameLst': {
				'p:attrName': 'ppt_x,ppt_y',
			},
		},
	};
	if (anim.motionPathRotationAngle !== undefined) {
		motionNode['@_rAng'] = String(Math.round(anim.motionPathRotationAngle * 60000));
	}
	if (
		anim.motionPathRotationCenterX !== undefined ||
		anim.motionPathRotationCenterY !== undefined
	) {
		motionNode['p:rCtr'] = {
			'@_x': String(Math.round((anim.motionPathRotationCenterX ?? 0) * 1000)),
			'@_y': String(Math.round((anim.motionPathRotationCenterY ?? 0) * 1000)),
		};
	}

	const effectCTn: XmlObject = {
		'@_id': String(effectId),
		'@_presetID': '0',
		'@_presetClass': 'path',
		'@_presetSubtype': '0',
		'@_fill': 'hold',
		'@_nodeType': nodeType,
		'@_dur': String(duration),
		'p:stCondLst': {
			'p:cond': {
				'@_delay': String(delay),
			},
		},
		'p:childTnLst': {
			'p:animMotion': motionNode,
		},
	};

	if (accel > 0) {
		effectCTn['@_accel'] = String(accel);
	}
	if (decel > 0) {
		effectCTn['@_decel'] = String(decel);
	}

	applySoundToEffectCTn(effectCTn, anim);

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
