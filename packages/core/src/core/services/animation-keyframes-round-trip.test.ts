/**
 * Round-trip tests for tav keyframes and animMotion / animRot / animScale
 * attribute parity. Exercises {@link extractKeyframes} and
 * {@link buildTavLstFromKeyframes} together to ensure every typed value
 * (`p:strVal`, `p:boolVal`, `p:intVal`, `p:fltVal`, `p:clrVal`) survives
 * the parse → serialize cycle, and that the new animMotion / animRot /
 * animScale attrs are preserved through the writer.
 */
import { describe, expect, it } from 'vitest';

import type { PptxAnimationKeyframe, PptxElementAnimation, XmlObject } from '../types';
import {
	buildAnimEffectNode,
	buildMotionPathNode,
	buildTavLstFromKeyframes,
} from './animation-write-node-builders';
import {
	extractChildKeyframes,
	extractChildMotionValues,
	extractKeyframes,
} from './native-animation-helpers';
import { PptxNativeAnimationService } from './PptxNativeAnimationService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBehaviorNodeWithKeyframes(keyframes: PptxAnimationKeyframe[]): XmlObject {
	const tavLst = buildTavLstFromKeyframes(keyframes);
	expect(tavLst).toBeDefined();
	return {
		'p:cBhvr': { 'p:cTn': { '@_id': '1' } },
		'p:tavLst': tavLst,
	};
}

function makeRoundTrip(keyframes: PptxAnimationKeyframe[]): PptxAnimationKeyframe[] {
	const node = buildBehaviorNodeWithKeyframes(keyframes);
	const parsed = extractKeyframes(node);
	expect(parsed).toBeDefined();
	return parsed!;
}

function buildSlideWithChildTnLst(childTnLst: XmlObject): XmlObject {
	return {
		'p:sld': {
			'p:timing': {
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:seq': {
									'p:cTn': {
										'@_nodeType': 'mainSeq',
										'p:childTnLst': {
											'p:par': {
												'p:cTn': {
													'@_presetClass': 'emph',
													'@_presetID': '0',
													'@_dur': '1000',
													'p:childTnLst': childTnLst,
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	};
}

// ---------------------------------------------------------------------------
// Keyframe round-trip
// ---------------------------------------------------------------------------

describe('animation tav keyframe round-trip', () => {
	it('round-trips a strVal keyframe', () => {
		const input: PptxAnimationKeyframe[] = [
			{ tm: 0, value: 'left', valueType: 'str' },
			{ tm: 100000, value: 'right', valueType: 'str' },
		];
		expect(makeRoundTrip(input)).toStrictEqual(input);
	});

	it('round-trips a boolVal keyframe', () => {
		const input: PptxAnimationKeyframe[] = [
			{ tm: 0, value: false, valueType: 'bool' },
			{ tm: 100000, value: true, valueType: 'bool' },
		];
		expect(makeRoundTrip(input)).toStrictEqual(input);
	});

	it('round-trips an intVal keyframe', () => {
		const input: PptxAnimationKeyframe[] = [
			{ tm: 0, value: 0, valueType: 'int' },
			{ tm: 50000, value: 42, valueType: 'int' },
			{ tm: 100000, value: -7, valueType: 'int' },
		];
		expect(makeRoundTrip(input)).toStrictEqual(input);
	});

	it('round-trips an fltVal keyframe', () => {
		const input: PptxAnimationKeyframe[] = [
			{ tm: 0, value: 0.25, valueType: 'flt' },
			{ tm: 100000, value: 1.5, valueType: 'flt' },
		];
		expect(makeRoundTrip(input)).toStrictEqual(input);
	});

	it('round-trips a hex clrVal keyframe via a:srgbClr', () => {
		const input: PptxAnimationKeyframe[] = [
			{ tm: 0, value: '#FF0000', valueType: 'clr' },
			{ tm: 100000, value: '#00FF00', valueType: 'clr' },
		];
		expect(makeRoundTrip(input)).toStrictEqual(input);
	});

	it('preserves the indefinite tm token', () => {
		const input: PptxAnimationKeyframe[] = [
			{ tm: 'indefinite', value: 'hold', valueType: 'str' },
			{ tm: 100000, value: 'go', valueType: 'str' },
		];
		expect(makeRoundTrip(input)).toStrictEqual(input);
	});

	it('preserves @_fmla on a tav entry', () => {
		const input: PptxAnimationKeyframe[] = [
			{ tm: 0, value: '0', valueType: 'str', fmla: '#ppt_x+0.1*sin(2*pi*$)' },
		];
		expect(makeRoundTrip(input)).toStrictEqual(input);
	});

	it('extractChildKeyframes finds keyframes nested under p:anim', () => {
		const keyframes: PptxAnimationKeyframe[] = [
			{ tm: 0, value: 0, valueType: 'flt' },
			{ tm: 100000, value: 1, valueType: 'flt' },
		];
		const childTnLst: XmlObject = {
			'p:anim': buildBehaviorNodeWithKeyframes(keyframes),
		};
		expect(extractChildKeyframes(childTnLst)).toStrictEqual(keyframes);
	});

	it('parses keyframes through PptxNativeAnimationService', () => {
		const keyframes: PptxAnimationKeyframe[] = [
			{ tm: 0, value: '1', valueType: 'str' },
			{ tm: 50000, value: '0.4', valueType: 'str' },
			{ tm: 100000, value: '1', valueType: 'str' },
		];
		const slide = buildSlideWithChildTnLst({
			'p:anim': {
				'p:cBhvr': {
					'p:cTn': { '@_id': '5' },
					'p:tgtEl': { 'p:spTgt': { '@_spid': 'shape1' } },
				},
				'p:tavLst': buildTavLstFromKeyframes(keyframes),
			},
		});

		const service = new PptxNativeAnimationService();
		const result = service.parseNativeAnimations(slide);
		expect(result).toBeDefined();
		expect(result!.length).toBeGreaterThan(0);
		const anim = result!.find((a) => a.targetId === 'shape1');
		expect(anim).toBeDefined();
		expect(anim!.keyframes).toStrictEqual(keyframes);
	});
});

// ---------------------------------------------------------------------------
// animRot / animScale / animMotion attr parity
// ---------------------------------------------------------------------------

describe('animRot @from / @to parity', () => {
	it('reads @_from and @_to alongside @_by', () => {
		const childTnLst: XmlObject = {
			'p:animRot': {
				'@_by': '21600000',
				'@_from': '0',
				'@_to': '21600000',
			},
		};
		const result = extractChildMotionValues(childTnLst);
		expect(result.rotationBy).toBe(360);
		expect(result.rotationFrom).toBe(0);
		expect(result.rotationTo).toBe(360);
	});
});

describe('animScale @from / @to / @zoomContents parity', () => {
	it('reads p:from, p:to, and @_zoomContents', () => {
		const childTnLst: XmlObject = {
			'p:animScale': {
				'@_zoomContents': '1',
				'p:by': { '@_x': '125000', '@_y': '125000' },
				'p:from': { '@_x': '100000', '@_y': '100000' },
				'p:to': { '@_x': '150000', '@_y': '200000' },
			},
		};
		const result = extractChildMotionValues(childTnLst);
		expect(result.scaleByX).toBeCloseTo(1.25);
		expect(result.scaleByY).toBeCloseTo(1.25);
		expect(result.scaleFromX).toBeCloseTo(1);
		expect(result.scaleFromY).toBeCloseTo(1);
		expect(result.scaleToX).toBeCloseTo(1.5);
		expect(result.scaleToY).toBeCloseTo(2);
		expect(result.scaleZoomContents).toBeTruthy();
	});
});

describe('animMotion ptsTypes / pathEditMode parity', () => {
	it('reads @_pathEditMode and @_ptsTypes', () => {
		const childTnLst: XmlObject = {
			'p:animMotion': {
				'@_path': 'M 0 0 L 1 1',
				'@_origin': 'layout',
				'@_pathEditMode': 'fixed',
				'@_ptsTypes': 'AAAFF',
			},
		};
		const result = extractChildMotionValues(childTnLst);
		expect(result.motionPath).toBe('M 0 0 L 1 1');
		expect(result.motionPathEditMode).toBe('fixed');
		expect(result.motionPtsTypes).toBe('AAAFF');
	});

	it('writer emits the configured pathEditMode and ptsTypes', () => {
		const allocator = (() => {
			let id = 100;
			return () => id++;
		})();
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			motionPath: 'M 0 0 L 1 1',
			motionPathEditMode: 'fixed',
			motionPtsTypes: 'AAAFF',
		};
		const node = buildMotionPathNode(anim, allocator);
		expect(node).toBeDefined();
		const outerCTn = (node as XmlObject)['p:cTn'] as XmlObject;
		const innerPar = (outerCTn['p:childTnLst'] as XmlObject)['p:par'] as XmlObject;
		const effectCTn = innerPar['p:cTn'] as XmlObject;
		const motionNode = (effectCTn['p:childTnLst'] as XmlObject)['p:animMotion'] as XmlObject;
		expect(motionNode['@_pathEditMode']).toBe('fixed');
		expect(motionNode['@_ptsTypes']).toBe('AAAFF');
	});

	it('writer falls back to relative pathEditMode and empty ptsTypes when unset', () => {
		const allocator = (() => {
			let id = 200;
			return () => id++;
		})();
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			motionPath: 'M 0 0 L 1 1',
		};
		const node = buildMotionPathNode(anim, allocator);
		expect(node).toBeDefined();
		const outerCTn = (node as XmlObject)['p:cTn'] as XmlObject;
		const innerPar = (outerCTn['p:childTnLst'] as XmlObject)['p:par'] as XmlObject;
		const effectCTn = innerPar['p:cTn'] as XmlObject;
		const motionNode = (effectCTn['p:childTnLst'] as XmlObject)['p:animMotion'] as XmlObject;
		expect(motionNode['@_pathEditMode']).toBe('relative');
		expect(motionNode['@_ptsTypes']).toBe('');
	});
});

// ---------------------------------------------------------------------------
// Sanity: emit of buildAnimEffectNode is unaffected by these changes.
// ---------------------------------------------------------------------------

describe('regression: buildAnimEffectNode still produces a fade animEffect', () => {
	it('produces filter=fade', () => {
		const node = buildAnimEffectNode('sp1', 500, 'in', () => 1);
		expect(node['@_filter']).toBe('fade');
	});
});
