import { describe, it, expect } from 'vitest';
import type { XmlObject, PptxElementAnimation } from '../types';
import { surgicallyUpdateTimingTree } from './animation-timing-surgical';

/**
 * Build a minimal timing tree with one effect targeting a specific shape.
 * Structure: p:tnLst > p:par[tmRoot] > p:seq[mainSeq] > p:par[clickGrp]
 *   > p:par[wrapper] > p:par[effect with presetClass]
 */
function buildMinimalTimingTree(
	shapeId: string,
	presetClass: string,
	presetId: number,
	duration: number,
): XmlObject {
	return {
		'p:tnLst': {
			'p:par': {
				'p:cTn': {
					'@_id': '1',
					'@_dur': 'indefinite',
					'@_restart': 'never',
					'@_nodeType': 'tmRoot',
					'p:childTnLst': {
						'p:seq': {
							'p:cTn': {
								'@_id': '2',
								'@_dur': 'indefinite',
								'@_nodeType': 'mainSeq',
								'p:childTnLst': {
									'p:par': {
										'p:cTn': {
											'@_id': '3',
											'@_fill': 'hold',
											'p:stCondLst': {
												'p:cond': { '@_delay': 'indefinite' },
											},
											'p:childTnLst': {
												'p:par': {
													'p:cTn': {
														'@_id': '4',
														'@_fill': 'hold',
														'p:childTnLst': {
															'p:par': {
																'p:cTn': {
																	'@_id': '5',
																	'@_presetID': String(presetId),
																	'@_presetClass': presetClass,
																	'@_presetSubtype': '0',
																	'@_dur': String(duration),
																	'@_nodeType': 'clickEffect',
																	'p:stCondLst': {
																		'p:cond': { '@_delay': '0' },
																	},
																	'p:childTnLst': {
																		'p:set': {
																			'p:cBhvr': {
																				'p:cTn': {
																					'@_id': '6',
																					'@_dur': '1',
																					'@_fill': 'hold',
																				},
																				'p:tgtEl': {
																					'p:spTgt': {
																						'@_spid': shapeId,
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
						},
					},
				},
			},
		},
	};
}

/** Navigate to the innermost effect p:cTn (the one with @_presetClass). */
function getEffectCTn(tree: XmlObject): XmlObject {
	const tnLst = tree['p:tnLst'] as XmlObject;
	const rootPar = tnLst['p:par'] as XmlObject;
	const rootCTn = rootPar['p:cTn'] as XmlObject;
	const rootChildren = rootCTn['p:childTnLst'] as XmlObject;
	const seq = rootChildren['p:seq'] as XmlObject;
	const seqCTn = seq['p:cTn'] as XmlObject;
	const seqChildren = seqCTn['p:childTnLst'] as XmlObject;
	const clickGrp = seqChildren['p:par'] as XmlObject;
	const clickCTn = clickGrp['p:cTn'] as XmlObject;
	const clickChildren = clickCTn['p:childTnLst'] as XmlObject;
	const wrapper = clickChildren['p:par'] as XmlObject;
	const wrapperCTn = wrapper['p:cTn'] as XmlObject;
	const wrapperChildren = wrapperCTn['p:childTnLst'] as XmlObject;
	const effect = wrapperChildren['p:par'] as XmlObject;
	return effect['p:cTn'] as XmlObject;
}

describe('surgicallyUpdateTimingTree', () => {
	it('should update duration of matching effect node', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape1',
				entrance: 'fadeIn',
				durationMs: 1000,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const effectCTn = getEffectCTn(result);
		expect(effectCTn['@_dur']).toBe('1000');
	});

	it('should preserve endCondLst when updating other attributes', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		// Inject an endCondLst into the effect node
		const effectCTn = getEffectCTn(tree);
		effectCTn['p:endCondLst'] = {
			'p:cond': { '@_evt': 'onClick', '@_delay': '0' },
		};

		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape1',
				entrance: 'fadeIn',
				durationMs: 800,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const updatedCTn = getEffectCTn(result);
		expect(updatedCTn['@_dur']).toBe('800');
		// endCondLst should be preserved
		expect(updatedCTn['p:endCondLst']).toBeDefined();
		const endCond = updatedCTn['p:endCondLst'] as XmlObject;
		expect((endCond['p:cond'] as XmlObject)?.['@_evt']).toBe('onClick');
	});

	it('should not modify nodes for elements not in animations list', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);
		const originalDur = getEffectCTn(tree)['@_dur'];

		// Only modify shape2 (not in the tree)
		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape2',
				entrance: 'zoomIn',
				durationMs: 700,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const effectCTn = getEffectCTn(result);
		expect(effectCTn['@_dur']).toBe(originalDur);
		expect(effectCTn['@_presetID']).toBe('10');
	});

	it('should update presetID when entrance preset changes', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape1',
				entrance: 'zoomIn',
				durationMs: 500,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const effectCTn = getEffectCTn(result);
		expect(effectCTn['@_presetID']).toBe('23'); // zoomIn presetId
		expect(effectCTn['@_presetClass']).toBe('entr');
	});

	it('should update delay in start condition list', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);

		const animations: PptxElementAnimation[] = [
			{
				elementId: 'shape1',
				entrance: 'fadeIn',
				durationMs: 500,
				delayMs: 250,
			},
		];

		const result = surgicallyUpdateTimingTree(tree, animations);
		const effectCTn = getEffectCTn(result);
		const stCondLst = effectCTn['p:stCondLst'] as XmlObject;
		const cond = stCondLst['p:cond'] as XmlObject;
		expect(cond['@_delay']).toBe('250');
	});

	it('should return tree unchanged when animations array is empty', () => {
		const tree = buildMinimalTimingTree('shape1', 'entr', 10, 500);
		const treeCopy = JSON.parse(JSON.stringify(tree)) as XmlObject;

		const result = surgicallyUpdateTimingTree(tree, []);
		expect(result).toEqual(treeCopy);
	});
});
