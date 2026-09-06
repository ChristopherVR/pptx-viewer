/**
 * Behavior-node (p:set / p:animEffect / p:animRot / p:animScale / p:anim)
 * builder functions for the OOXML animation write service. Extracted from
 * `animation-write-node-builders` to keep file sizes manageable.
 */
import type {
	PptxAnimationKeyframe,
	PptxAnimationPreset,
	PptxElementAnimation,
	XmlObject,
} from '../types';
import {
	buildTavLstFromKeyframes,
	DEFAULT_OPACITY_KEYFRAMES,
} from './animation-write-node-keyframes';

/** Emphasis presets that use p:animRot (rotation). */
export const ROTATION_EMPHASIS: ReadonlySet<string> = new Set(['spin', 'teeter']);

/** Emphasis presets that use p:animScale. */
export const SCALE_EMPHASIS: ReadonlySet<string> = new Set(['growShrink']);

/** Emphasis presets that use p:anim on style.opacity. */
export const OPACITY_EMPHASIS: ReadonlySet<string> = new Set([
	'transparency',
	'flash',
	'boldFlash',
]);

/**
 * Apply (or clear) an effect's `p:stSnd` / `p:endSnd` sound action onto its
 * `p:cTn` (CT_TLCommonTimeNodeData). Shared by the full-rebuild builders below
 * and the surgical updater (`animation-timing-surgical`) so an existing
 * effect's sound can be edited without rebuilding the whole node.
 */
export function applySoundToEffectCTn(
	effectCTn: XmlObject,
	anim: Pick<PptxElementAnimation, 'soundRId' | 'stopSound'>,
): void {
	delete effectCTn['p:stSnd'];
	delete effectCTn['p:endSnd'];
	if (anim.stopSound) {
		effectCTn['p:endSnd'] = {};
	} else if (anim.soundRId) {
		effectCTn['p:stSnd'] = {
			'p:snd': {
				'@_r:embed': anim.soundRId,
			},
		};
	}
}

/**
 * Build a p:set node for toggling element visibility.
 */
export function buildVisibilitySet(
	shapeId: string,
	duration: number,
	makeVisible: boolean,
	allocateId: () => number,
): XmlObject {
	const setId = allocateId();
	return {
		_type: 'set',
		'p:cBhvr': {
			'p:cTn': {
				'@_id': String(setId),
				'@_dur': '1',
				'@_fill': 'hold',
				'p:stCondLst': {
					'p:cond': {
						'@_delay': makeVisible ? '0' : String(duration),
					},
				},
			},
			'p:tgtEl': {
				'p:spTgt': {
					'@_spid': shapeId,
				},
			},
			'p:attrNameLst': {
				'p:attrName': 'style.visibility',
			},
		},
		'p:to': {
			'p:strVal': {
				'@_val': makeVisible ? 'visible' : 'hidden',
			},
		},
	} as XmlObject;
}

/**
 * Build a p:animEffect node for visual transition effects.
 */
export function buildAnimEffectNode(
	shapeId: string,
	duration: number,
	transition: 'in' | 'out',
	allocateId: () => number,
): XmlObject {
	const animId = allocateId();
	return {
		_type: 'animEffect',
		'@_transition': transition,
		'@_filter': 'fade',
		'p:cBhvr': {
			'p:cTn': {
				'@_id': String(animId),
				'@_dur': String(duration),
			},
			'p:tgtEl': {
				'p:spTgt': {
					'@_spid': shapeId,
				},
			},
		},
	} as XmlObject;
}

/**
 * Build a p:animRot node for rotation emphasis (spin, teeter).
 */
export function buildAnimRotNode(
	shapeId: string,
	duration: number,
	preset: PptxAnimationPreset,
	allocateId: () => number,
): XmlObject {
	const animId = allocateId();
	// Spin: full 360 degree rotation (21600000 = 360 * 60000)
	// Teeter: small oscillation (300000 = 5 degrees * 60000)
	const byAngle = preset === 'spin' ? '21600000' : '300000';
	return {
		_type: 'animRot',
		'@_by': byAngle,
		'p:cBhvr': {
			'p:cTn': {
				'@_id': String(animId),
				'@_dur': String(duration),
				'@_fill': 'hold',
			},
			'p:tgtEl': {
				'p:spTgt': {
					'@_spid': shapeId,
				},
			},
			'p:attrNameLst': {
				'p:attrName': 'r',
			},
		},
	} as XmlObject;
}

/**
 * Build a p:animScale node for scale emphasis (growShrink).
 */
export function buildAnimScaleNode(
	shapeId: string,
	duration: number,
	allocateId: () => number,
): XmlObject {
	const animId = allocateId();
	return {
		_type: 'animScale',
		'p:by': {
			'@_x': '125000',
			'@_y': '125000',
		},
		'p:cBhvr': {
			'p:cTn': {
				'@_id': String(animId),
				'@_dur': String(duration),
				'@_fill': 'hold',
				'@_autoRev': '1',
			},
			'p:tgtEl': {
				'p:spTgt': {
					'@_spid': shapeId,
				},
			},
		},
	} as XmlObject;
}

/**
 * Build a p:anim node for property animations (opacity, etc.).
 *
 * When `keyframes` are provided, they are serialized verbatim into the
 * `p:tavLst`. Otherwise the historic default 3-stop keyframes (0 -> 0.4 -> 1)
 * are emitted to preserve emphasis-effect playback for animations that
 * never carried explicit keyframes.
 */
export function buildAnimPropertyNode(
	shapeId: string,
	duration: number,
	attrName: string,
	allocateId: () => number,
	keyframes?: ReadonlyArray<PptxAnimationKeyframe>,
): XmlObject {
	const animId = allocateId();
	const tavLst =
		buildTavLstFromKeyframes(keyframes) ?? buildTavLstFromKeyframes(DEFAULT_OPACITY_KEYFRAMES)!;
	return {
		_type: 'anim',
		'@_calcmode': 'lin',
		'@_valueType': 'num',
		'p:cBhvr': {
			'p:cTn': {
				'@_id': String(animId),
				'@_dur': String(duration),
				'@_fill': 'hold',
			},
			'p:tgtEl': {
				'p:spTgt': {
					'@_spid': shapeId,
				},
			},
			'p:attrNameLst': {
				'p:attrName': attrName,
			},
		},
		'p:tavLst': tavLst,
	} as XmlObject;
}
