import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { PptxNativeAnimationService } from './PptxNativeAnimationService';

/**
 * Build a minimal timing tree for a single effect `p:cTn` whose
 * `p:animEffect` child carries `@filter`/`@transition` but, unlike the
 * decks `PptxNativeAnimationService.test.ts` exercises, the effect `p:cTn`
 * itself may omit `@presetID`/`@presetClass` entirely - the shape a
 * non-PowerPoint authoring tool is likely to emit.
 */
function buildFilterOnlySlide(
	shapeId: string,
	filter: string,
	opts?: { transition?: string; presetClass?: string; presetId?: number },
): XmlObject {
	return {
		'p:sld': {
			'p:timing': {
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
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
													'p:stCondLst': { 'p:cond': { '@_delay': 'indefinite' } },
													'p:childTnLst': {
														'p:par': {
															'p:cTn': {
																'@_id': '4',
																'@_presetID':
																	opts?.presetId !== undefined ? String(opts.presetId) : undefined,
																'@_presetClass': opts?.presetClass,
																'@_dur': '500',
																'@_nodeType': 'clickEffect',
																'p:childTnLst': {
																	'p:animEffect': {
																		'@_filter': filter,
																		'@_transition': opts?.transition,
																		'p:cBhvr': {
																			'p:tgtEl': { 'p:spTgt': { '@_spid': shapeId } },
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

describe('pptxNativeAnimationService: p:animEffect @filter', () => {
	const service = new PptxNativeAnimationService();

	it('does not drop an effect node whose @presetClass is entirely absent', () => {
		const slideXml = buildFilterOnlySlide('shape1', 'wipe(up)');
		const result = service.parseNativeAnimations(slideXml);
		expect(result).toBeDefined();
		expect(result).toHaveLength(1);
		expect(result![0].targetId).toBe('shape1');
	});

	it('parses the filter descriptor onto effectFilter', () => {
		const slideXml = buildFilterOnlySlide('shape1', 'barn(inVertical)', { transition: 'in' });
		const result = service.parseNativeAnimations(slideXml);
		expect(result![0].effectFilter).toStrictEqual({
			family: 'barn',
			subtype: 'inVertical',
			transition: 'in',
			raw: 'barn(inVertical)',
		});
	});

	it('derives presetClass "entr" from a default/"in" transition when @presetClass is absent', () => {
		const slideXml = buildFilterOnlySlide('shape1', 'checkerboard(across)', { transition: 'in' });
		const result = service.parseNativeAnimations(slideXml);
		expect(result![0].presetClass).toBe('entr');
	});

	it('derives presetClass "exit" from transition="out" when @presetClass is absent', () => {
		const slideXml = buildFilterOnlySlide('shape1', 'wipe(left)', { transition: 'out' });
		const result = service.parseNativeAnimations(slideXml);
		expect(result![0].presetClass).toBe('exit');
	});

	it('an explicit @presetClass wins over the transition-derived default', () => {
		const slideXml = buildFilterOnlySlide('shape1', 'fade', {
			transition: 'in',
			presetClass: 'exit',
		});
		const result = service.parseNativeAnimations(slideXml);
		expect(result![0].presetClass).toBe('exit');
	});

	it('still drops an effect node with neither @presetClass nor a @filter', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:timing': {
					'p:tnLst': {
						'p:par': {
							'p:cTn': {
								'@_id': '1',
								'@_nodeType': 'tmRoot',
								'p:childTnLst': {
									'p:seq': {
										'p:cTn': {
											'@_id': '2',
											'@_nodeType': 'mainSeq',
											'p:childTnLst': {
												'p:par': {
													'p:cTn': {
														'@_id': '3',
														'p:stCondLst': { 'p:cond': { '@_delay': 'indefinite' } },
														'p:childTnLst': {
															'p:par': {
																'p:cTn': {
																	'@_id': '4',
																	'@_nodeType': 'clickEffect',
																	'p:childTnLst': {
																		'p:animEffect': {
																			'p:cBhvr': {
																				'p:tgtEl': { 'p:spTgt': { '@_spid': 'shape1' } },
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
		expect(service.parseNativeAnimations(slideXml)).toBeUndefined();
	});

	it('parses filter alongside a recognised presetId (both survive on the model)', () => {
		const slideXml = buildFilterOnlySlide('shape1', 'wipe(up)', {
			presetId: 22,
			presetClass: 'entr',
		});
		const result = service.parseNativeAnimations(slideXml);
		expect(result![0].presetId).toBe(22);
		expect(result![0].presetClass).toBe('entr');
		expect(result![0].effectFilter?.family).toBe('wipe');
	});
});
