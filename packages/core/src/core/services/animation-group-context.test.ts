import { describe, it, expect } from 'vitest';

import type { PptxElementAnimation, PptxNativeAnimation, XmlObject } from '../types';
import {
	conditionsStartAutomatically,
	isEffectNode,
	isMainSequence,
} from './animation-group-context';
import { PptxAnimationWriteService } from './PptxAnimationWriteService';
import { PptxNativeAnimationService } from './PptxNativeAnimationService';

const service = new PptxNativeAnimationService();

// ==========================================================================
// Condition classification
// ==========================================================================

describe('conditionsStartAutomatically', () => {
	it('treats a missing node or condition list as ungated', () => {
		expect(conditionsStartAutomatically(undefined)).toBeTruthy();
		expect(conditionsStartAutomatically({})).toBeTruthy();
		expect(conditionsStartAutomatically({ 'p:stCondLst': {} })).toBeTruthy();
	});

	it('gates on a lone indefinite delay (PowerPoint "On Click")', () => {
		expect(
			conditionsStartAutomatically({
				'p:stCondLst': { 'p:cond': { '@_delay': 'indefinite' } },
			}),
		).toBeFalsy();
	});

	it('auto-starts when a time-node condition coexists with the indefinite gate', () => {
		expect(
			conditionsStartAutomatically({
				'p:stCondLst': {
					'p:cond': [
						{ '@_delay': 'indefinite' },
						{ '@_evt': 'onBegin', '@_delay': '0', 'p:tn': { '@_val': '2' } },
					],
				},
			}),
		).toBeTruthy();
	});

	it('does not treat a non-concurrent main sequence self-reference as automatic', () => {
		const cTn: XmlObject = {
			'p:stCondLst': {
				'p:cond': [
					{ '@_delay': 'indefinite' },
					{ '@_evt': 'onBegin', '@_delay': '0', 'p:tn': { '@_val': '2' } },
				],
			},
		};
		expect(conditionsStartAutomatically(cTn, { autoStart: false, id: '2' })).toBeFalsy();
		expect(conditionsStartAutomatically(cTn, { autoStart: true, id: '2' })).toBeTruthy();
	});

	it('auto-starts on a finite delay with no event', () => {
		expect(
			conditionsStartAutomatically({
				'p:stCondLst': { 'p:cond': { '@_delay': '0' } },
			}),
		).toBeTruthy();
	});

	it('stays gated for interaction events', () => {
		expect(
			conditionsStartAutomatically({
				'p:stCondLst': { 'p:cond': { '@_evt': 'onClick', '@_delay': '0' } },
			}),
		).toBeFalsy();
		expect(
			conditionsStartAutomatically({
				'p:stCondLst': { 'p:cond': { '@_evt': 'onMouseOver', '@_delay': '0' } },
			}),
		).toBeFalsy();
	});
});

describe('node classification', () => {
	it('recognises the mainSeq node', () => {
		expect(isMainSequence({ '@_nodeType': 'mainSeq' })).toBeTruthy();
		expect(isMainSequence({ '@_nodeType': 'tmRoot' })).toBeFalsy();
		expect(isMainSequence(undefined)).toBeFalsy();
	});

	it('recognises an effect node by its preset class', () => {
		expect(isEffectNode({ '@_presetClass': 'entr' })).toBeTruthy();
		expect(isEffectNode({ '@_fill': 'hold' })).toBeFalsy();
		expect(isEffectNode(undefined)).toBeFalsy();
	});
});

// ==========================================================================
// End-to-end: the shape PowerPoint writes for two simultaneous entrances
// ==========================================================================

/**
 * Mirrors the real `p:timing` of a deck whose title and subtitle both start
 * "With Previous" (issue #106): the click step carries the indefinite gate AND
 * an `onBegin` tie to the mainSeq, and both effects live in ONE wrapper `p:par`
 * with their own delays.
 */
function buildAutoStartTiming(
	clickStepConditions: XmlObject,
	sequenceAttrs: XmlObject = { '@_concurrent': '1', '@_nextAc': 'seek' },
): XmlObject {
	const effect = (id: string, spid: string, delay: string): XmlObject => ({
		'p:cTn': {
			'@_id': id,
			'@_presetID': '10',
			'@_presetClass': 'entr',
			'@_nodeType': 'withEffect',
			'p:stCondLst': { 'p:cond': { '@_delay': delay } },
			'p:childTnLst': {
				'p:animEffect': {
					'@_transition': 'in',
					'@_filter': 'fade',
					'p:cBhvr': {
						'p:cTn': { '@_id': `${id}b`, '@_dur': '400' },
						'p:tgtEl': { 'p:spTgt': { '@_spid': spid } },
					},
				},
			},
		},
	});

	return {
		'p:sld': {
			'p:timing': {
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:seq': {
									...sequenceAttrs,
									'p:cTn': {
										'@_id': '2',
										'@_nodeType': 'mainSeq',
										'p:childTnLst': {
											'p:par': {
												'p:cTn': {
													'@_id': '3',
													'p:stCondLst': clickStepConditions,
													'p:childTnLst': {
														'p:par': {
															'p:cTn': {
																'@_id': '4',
																'p:stCondLst': { 'p:cond': { '@_delay': '0' } },
																'p:childTnLst': {
																	'p:par': [effect('5', '2', '1000'), effect('8', '3', '2000')],
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
					},
				},
			},
		},
	};
}

describe('click-step grouping metadata', () => {
	const autoConditions: XmlObject = {
		'p:cond': [
			{ '@_delay': 'indefinite' },
			{ '@_evt': 'onBegin', '@_delay': '0', 'p:tn': { '@_val': '2' } },
		],
	};

	it('marks effects of an auto-starting click step', () => {
		const result = service.parseNativeAnimations(buildAutoStartTiming(autoConditions));
		expect(result).toBeDefined();
		const effects = result!.filter((a) => a.presetClass === 'entr');
		expect(effects).toHaveLength(2);
		for (const anim of effects) {
			expect(anim.groupAutoStart).toBeTruthy();
		}
	});

	it('leaves a click-gated step un-marked', () => {
		const result = service.parseNativeAnimations(
			buildAutoStartTiming({ 'p:cond': { '@_delay': 'indefinite' } }),
		);
		const effects = result!.filter((a) => a.presetClass === 'entr');
		expect(effects).toHaveLength(2);
		for (const anim of effects) {
			expect(anim.groupAutoStart).toBeFalsy();
		}
	});

	it('keeps a self-referenced step gated when mainSeq lacks auto-start attributes', () => {
		const result = service.parseNativeAnimations(buildAutoStartTiming(autoConditions, {}));
		const effects = result!.filter((a) => a.presetClass === 'entr');
		expect(effects).toHaveLength(2);
		for (const anim of effects) {
			expect(anim.groupAutoStart).toBeFalsy();
		}
	});

	it('gives effects sharing one wrapper p:par the same group index', () => {
		const result = service.parseNativeAnimations(buildAutoStartTiming(autoConditions));
		const effects = result!.filter((a) => a.presetClass === 'entr');
		expect(effects[0].parGroupIndex).toBeDefined();
		expect(effects[1].parGroupIndex).toBe(effects[0].parGroupIndex);
	});
});

// ==========================================================================
// Writer round-trip: an auto-starting first step survives a save
// ==========================================================================

describe('writing the first click step', () => {
	const writer = new PptxAnimationWriteService();

	function parseBack(animations: PptxElementAnimation[]): PptxNativeAnimation[] {
		const timing = writer.buildTimingXml(animations, undefined);
		expect(timing).toBeDefined();
		const parsed = service.parseNativeAnimations({ 'p:sld': { 'p:timing': timing } });
		expect(parsed).toBeDefined();
		return parsed!;
	}

	it('keeps a "with previous" opening effect auto-starting', () => {
		const parsed = parseBack([
			{ elementId: 'title', entrance: 'fadeIn', trigger: 'withPrevious', durationMs: 400 },
		]);
		expect(parsed.some((a) => a.groupAutoStart === true)).toBeTruthy();
	});

	it('keeps a click-gated opening effect waiting for the click', () => {
		const parsed = parseBack([
			{ elementId: 'title', entrance: 'fadeIn', trigger: 'onClick', durationMs: 400 },
		]);
		expect(parsed.every((a) => a.groupAutoStart !== true)).toBeTruthy();
	});
});
