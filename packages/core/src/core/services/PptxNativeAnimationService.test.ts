import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { PptxNativeAnimationService } from './PptxNativeAnimationService';

/**
 * Helper: wrap an animation effect in a minimal p:sld > p:timing > p:tnLst tree.
 * The `effectCTn` should be a `p:cTn` content for the effect node.
 */
function buildSlideXmlWithTiming(timingContent: XmlObject): XmlObject {
	return {
		'p:sld': {
			'p:timing': timingContent,
		},
	};
}

/**
 * Build a minimal timing tree with a single entrance animation effect.
 */
function buildSimpleEntranceSlide(
	shapeId: string,
	opts?: {
		presetId?: number;
		duration?: number;
		delay?: number;
		nodeType?: string;
		accel?: string;
		decel?: string;
	},
): XmlObject {
	const presetId = opts?.presetId ?? 10;
	const duration = opts?.duration ?? 500;
	const delay = opts?.delay ?? 0;
	const nodeType = opts?.nodeType ?? 'clickEffect';

	return buildSlideXmlWithTiming({
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
												'p:cond': {
													'@_delay': 'indefinite',
												},
											},
											'p:childTnLst': {
												'p:par': {
													'p:cTn': {
														'@_id': '4',
														'@_presetID': String(presetId),
														'@_presetClass': 'entr',
														'@_dur': String(duration),
														'@_delay': delay > 0 ? String(delay) : undefined,
														'@_accel': opts?.accel,
														'@_decel': opts?.decel,
														'@_nodeType': nodeType,
														'p:childTnLst': {
															'p:animEffect': {
																'p:cBhvr': {
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
	});
}

describe('pptxNativeAnimationService', () => {
	const service = new PptxNativeAnimationService();

	// -----------------------------------------------------------------------
	// parseNativeAnimations - basic cases
	// -----------------------------------------------------------------------
	describe('parseNativeAnimations', () => {
		it('returns undefined for empty object', () => {
			expect(service.parseNativeAnimations({})).toBeUndefined();
		});

		it('returns undefined when p:sld is missing', () => {
			expect(service.parseNativeAnimations({ foo: 'bar' })).toBeUndefined();
		});

		it('returns undefined when p:timing is missing', () => {
			expect(service.parseNativeAnimations({ 'p:sld': {} })).toBeUndefined();
		});

		it('returns undefined when p:timing is not an object', () => {
			expect(
				service.parseNativeAnimations({
					'p:sld': { 'p:timing': 'invalid' },
				}),
			).toBeUndefined();
		});

		it('returns undefined when p:tnLst is missing', () => {
			expect(
				service.parseNativeAnimations({
					'p:sld': { 'p:timing': {} },
				}),
			).toBeUndefined();
		});

		it('returns undefined when rootPar is missing', () => {
			expect(
				service.parseNativeAnimations({
					'p:sld': { 'p:timing': { 'p:tnLst': {} } },
				}),
			).toBeUndefined();
		});

		it('returns undefined when timing tree yields no animations', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
						},
					},
				},
			});
			expect(service.parseNativeAnimations(slideXml)).toBeUndefined();
		});

		it('parses a single entrance animation', () => {
			const slideXml = buildSimpleEntranceSlide('shape1');
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].targetId).toBe('shape1');
			expect(result![0].presetClass).toBe('entr');
			expect(result![0].presetId).toBe(10);
			expect(result![0].durationMs).toBe(500);
		});

		it('parses accel / decel timing percentages into 0..1 fractions', () => {
			const slideXml = buildSimpleEntranceSlide('shape1', {
				accel: '50000',
				decel: '25000',
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].accel).toBe(0.5);
			expect(result![0].decel).toBe(0.25);
		});

		it('leaves accel / decel undefined when the attributes are absent', () => {
			const slideXml = buildSimpleEntranceSlide('shape1');
			const result = service.parseNativeAnimations(slideXml);
			expect(result![0].accel).toBeUndefined();
			expect(result![0].decel).toBeUndefined();
		});

		it("extracts trigger from nodeType 'afterPrevious'", () => {
			const slideXml = buildSimpleEntranceSlide('shape1', {
				nodeType: 'afterPrevious',
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe('afterPrevious');
		});

		it("extracts trigger from nodeType 'withEffect'", () => {
			const slideXml = buildSimpleEntranceSlide('shape1', {
				nodeType: 'withEffect',
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe('withPrevious');
		});

		it("extracts trigger from nodeType 'clickEffect' as onClick", () => {
			const slideXml = buildSimpleEntranceSlide('shape1', {
				nodeType: 'clickEffect',
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe('onClick');
		});

		it("extracts trigger from nodeType 'afterPrev'", () => {
			const slideXml = buildSimpleEntranceSlide('shape1', {
				nodeType: 'afterPrev',
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe('afterPrevious');
		});

		it("extracts trigger from nodeType 'afterEffect' (the real OOXML value)", () => {
			// PowerPoint itself only ever emits 'afterEffect' for a "Start: After
			// Previous" effect (ECMA-376 ST_TLTimeNodeType); 'afterPrevious' and
			// 'afterPrev', covered above, do not occur in real files - they are
			// this codebase's own internal trigger name, not an XML value. Real
			// decks (e.g. a staggered wipe-in logo built from several shapes)
			// fell through to the inherited trigger instead, desyncing the
			// stagger between siblings and leaving a visible gap mid-animation.
			const slideXml = buildSimpleEntranceSlide('shape1', {
				nodeType: 'afterEffect',
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe('afterPrevious');
		});

		it("extracts trigger from nodeType 'mouseOver' as onHover", () => {
			const slideXml = buildSimpleEntranceSlide('shape1', {
				nodeType: 'mouseOver',
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe('onHover');
		});

		it('extracts duration and delay', () => {
			const slideXml = buildSimpleEntranceSlide('shape1', {
				duration: 1500,
				delay: 300,
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].durationMs).toBe(1500);
			expect(result![0].delayMs).toBe(300);
		});

		it('validates preset class against known values', () => {
			// Use an invalid presetClass to make sure it's filtered
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'invalidClass',
										'@_dur': '500',
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'shape1',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].presetClass).toBeUndefined();
		});

		it('detects afterDelay trigger from stCondLst with positive delay', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'@_delay': '2000',
										'p:stCondLst': {
											'p:cond': {
												'@_delay': '2000',
											},
										},
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'shape1',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe('afterDelay');
			expect(result![0].triggerDelayMs).toBe(2000);
		});

		it('parses multiple animations from nested p:par containers', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': [
									{
										'p:cTn': {
											'@_id': '2',
											'@_presetID': '10',
											'@_presetClass': 'entr',
											'@_dur': '500',
											'@_nodeType': 'clickEffect',
											'p:childTnLst': {
												'p:animEffect': {
													'p:cBhvr': {
														'p:tgtEl': {
															'p:spTgt': {
																'@_spid': 'shape1',
															},
														},
													},
												},
											},
										},
									},
									{
										'p:cTn': {
											'@_id': '3',
											'@_presetID': '1',
											'@_presetClass': 'exit',
											'@_dur': '250',
											'@_nodeType': 'afterPrevious',
											'p:childTnLst': {
												'p:animEffect': {
													'p:cBhvr': {
														'p:tgtEl': {
															'p:spTgt': {
																'@_spid': 'shape2',
															},
														},
													},
												},
											},
										},
									},
								],
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(2);
			expect(result![0].targetId).toBe('shape1');
			expect(result![0].presetClass).toBe('entr');
			expect(result![1].targetId).toBe('shape2');
			expect(result![1].presetClass).toBe('exit');
			expect(result![1].trigger).toBe('afterPrevious');
		});

		it('extracts motion path from p:animMotion in child nodes', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '0',
										'@_presetClass': 'path',
										'@_dur': '2000',
										'p:childTnLst': {
											'p:animMotion': {
												'@_path': 'M 0 0 L 1 1',
												'@_origin': 'layout',
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'shapeMotion',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].targetId).toBe('shapeMotion');
			expect(result![0].motionPath).toBe('M 0 0 L 1 1');
			expect(result![0].motionOrigin).toBe('layout');
		});

		it('extracts rotation from p:animRot in child nodes', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '8',
										'@_presetClass': 'emph',
										'@_dur': '1000',
										'p:childTnLst': {
											'p:animRot': {
												'@_by': '21600000',
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'spinShape',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].rotationBy).toBe(360);
		});

		it('extracts scale from p:animScale in child nodes', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '6',
										'@_presetClass': 'emph',
										'@_dur': '1000',
										'p:childTnLst': {
											'p:animScale': {
												'p:by': {
													'@_x': '150000',
													'@_y': '200000',
												},
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'scaleShape',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].scaleByX).toBe(1.5);
			expect(result![0].scaleByY).toBe(2.0);
		});

		it('extracts sound reference from p:stSnd', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'p:stSnd': {
											'p:snd': {
												'@_r:embed': 'rId5',
											},
										},
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'sndShape',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].soundRId).toBe('rId5');
		});

		it('extracts repeat info from cTn attributes', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'@_repeatCount': '3000',
										'@_autoRev': '1',
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'repeatShape',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].repeatCount).toBe(3);
			expect(result![0].autoReverse).toBeTruthy();
		});

		it('applies build list to matching animations', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'textShape',
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
				'p:bldLst': {
					'p:bldP': {
						'@_spid': 'textShape',
						'@_build': 'p',
						'@_grpId': '0',
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].buildType).toBe('byParagraph');
			expect(result![0].groupId).toBe('0');
		});

		it('applies OLE chart build info to matching animations', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'chartShape',
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
				'p:bldLst': {
					'p:bldOleChart': {
						'@_spid': 'chartShape',
						'@_grpId': '5',
						'@_bld': 'series',
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].groupId).toBe('5');
			expect(result![0].oleChartBuild).toBe('series');
		});

		it('preserves rawEndCondLst from the timing node', () => {
			const endCondLst = {
				'p:cond': { '@_evt': 'onClick', '@_delay': '0' },
			};
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'p:endCondLst': endCondLst,
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'shape1',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].rawEndCondLst).toBeDefined();
			expect((result![0].rawEndCondLst!['p:cond'] as XmlObject)['@_evt']).toBe('onClick');
		});

		it('marks animations inside exclusive containers', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:excl': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'exclShape',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].exclusive).toBeTruthy();
		});

		it('gives siblings of the same p:excl container the same exclGroupId, and a different container a different one', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:excl': [
									{
										'p:cTn': {
											'@_id': '2',
											'p:childTnLst': {
												'p:par': [
													{
														'p:cTn': {
															'@_id': '3',
															'@_presetID': '10',
															'@_presetClass': 'entr',
															'@_dur': '500',
															'p:childTnLst': {
																'p:animEffect': {
																	'p:cBhvr': {
																		'p:tgtEl': { 'p:spTgt': { '@_spid': 'exclA1' } },
																	},
																},
															},
														},
													},
													{
														'p:cTn': {
															'@_id': '4',
															'@_presetID': '10',
															'@_presetClass': 'entr',
															'@_dur': '500',
															'p:childTnLst': {
																'p:animEffect': {
																	'p:cBhvr': {
																		'p:tgtEl': { 'p:spTgt': { '@_spid': 'exclA2' } },
																	},
																},
															},
														},
													},
												],
											},
										},
									},
									{
										'p:cTn': {
											'@_id': '5',
											'@_presetID': '10',
											'@_presetClass': 'entr',
											'@_dur': '500',
											'p:childTnLst': {
												'p:animEffect': {
													'p:cBhvr': {
														'p:tgtEl': { 'p:spTgt': { '@_spid': 'exclB1' } },
													},
												},
											},
										},
									},
								],
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			const byShape = new Map(result!.map((a) => [a.targetId, a]));
			const a1 = byShape.get('exclA1');
			const a2 = byShape.get('exclA2');
			const b1 = byShape.get('exclB1');
			expect(a1?.exclusive).toBeTruthy();
			expect(a2?.exclusive).toBeTruthy();
			expect(b1?.exclusive).toBeTruthy();
			expect(a1?.exclGroupId).toBeDefined();
			expect(a1?.exclGroupId).toBe(a2?.exclGroupId);
			expect(b1?.exclGroupId).toBeDefined();
			expect(b1?.exclGroupId).not.toBe(a1?.exclGroupId);
		});

		it('extracts text target from p:animEffect with p:txEl', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'txtShape',
															'p:txEl': {
																'p:pRg': {
																	'@_st': '0',
																	'@_end': '3',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].textTarget).toBeDefined();
			expect(result![0].textTarget!.type).toBe('pRg');
			expect(result![0].textTarget!.start).toBe(0);
			expect(result![0].textTarget!.end).toBe(3);
		});

		it('extracts color animation from p:animClr', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '2',
										'@_presetClass': 'emph',
										'@_dur': '1000',
										'p:childTnLst': {
											// p:set provides the target ID for extractAnimationTargetId
											'p:set': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'clrShape',
														},
													},
												},
											},
											'p:animClr': {
												'@_clrSpc': 'hsl',
												'@_dir': 'cw',
												'p:from': {
													'a:srgbClr': { '@_val': 'FF0000' },
												},
												'p:to': {
													'a:srgbClr': { '@_val': '0000FF' },
												},
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'clrShape',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].colorAnimation).toBeDefined();
			expect(result![0].colorAnimation!.colorSpace).toBe('hsl');
			expect(result![0].colorAnimation!.direction).toBe('cw');
			expect(result![0].colorAnimation!.fromColor).toBe('#FF0000');
			expect(result![0].colorAnimation!.toColor).toBe('#0000FF');
		});

		it('preserves signed HSL deltas and every sibling p:animClr behaviour', () => {
			const colorBehaviour = (targetAttribute: string, h: string, s: string, l: string) => ({
				'@_clrSpc': 'hsl',
				'p:by': { 'p:hsl': { '@_h': h, '@_s': s, '@_l': l } },
				'p:cBhvr': {
					'p:tgtEl': { 'p:spTgt': { '@_spid': 'clrShape' } },
					'p:attrNameLst': { 'p:attrName': targetAttribute },
				},
			});
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '1',
										'@_presetClass': 'emph',
										'@_dur': '1000',
										'p:childTnLst': {
											'p:animClr': [
												colorBehaviour('style.color', '7200000', '0', '0'),
												colorBehaviour('fillcolor', '0', '-12549', '-25098'),
												colorBehaviour('stroke.color', '-3600000', '5000', '10000'),
											],
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			const color = result?.[0]?.colorAnimation;
			expect(color?.hslDelta).toStrictEqual({ hue: 120, saturation: 0, lightness: 0 });
			expect(color?.components).toHaveLength(3);
			expect(color?.components?.map((component) => component.targetAttribute)).toStrictEqual([
				'style.color',
				'fillcolor',
				'stroke.color',
			]);
			expect(color?.components?.[1]?.hslDelta).toStrictEqual({
				hue: 0,
				saturation: -12.549,
				lightness: -25.098,
			});
			expect(color?.components?.[2]?.hslDelta).toStrictEqual({
				hue: -60,
				saturation: 5,
				lightness: 10,
			});
		});

		it('extracts command from p:cmd in child timing list', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '1',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'p:childTnLst': {
											// p:set provides the target ID for extractAnimationTargetId
											'p:set': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'cmdShape',
														},
													},
												},
											},
											'p:cmd': {
												'@_type': 'call',
												'@_cmd': 'playFrom(0)',
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'cmdShape',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].commandType).toBe('call');
			expect(result![0].commandString).toBe('playFrom(0)');
		});

		it('extracts iterate from p:iterate in cTn', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'p:iterate': {
											'@_type': 'lt',
											'@_backwards': '1',
											'p:tmPct': { '@_val': '10000' },
										},
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'iterShape',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].iterate).toBeDefined();
			expect(result![0].iterate!.type).toBe('lt');
			expect(result![0].iterate!.backwards).toBeTruthy();
			expect(result![0].iterate!.tmPct).toBe(10000);
		});
	});

	// -----------------------------------------------------------------------
	// Interactive sequences
	// -----------------------------------------------------------------------
	describe('interactive sequences', () => {
		it('parses interactive sequences with onShapeClick trigger', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_restart': 'never',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:seq': [
									{
										'p:cTn': {
											'@_id': '2',
											'@_dur': 'indefinite',
											'@_nodeType': 'mainSeq',
											'p:childTnLst': {
												'p:par': {
													'p:cTn': {
														'@_id': '3',
														'@_presetID': '10',
														'@_presetClass': 'entr',
														'@_dur': '500',
														'p:childTnLst': {
															'p:animEffect': {
																'p:cBhvr': {
																	'p:tgtEl': {
																		'p:spTgt': {
																			'@_spid': 'mainShape',
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
									{
										'p:cTn': {
											'@_id': '10',
											'@_dur': 'indefinite',
											'@_nodeType': 'interactiveSeq',
											'p:stCondLst': {
												'p:cond': {
													'@_evt': 'onClick',
													'@_delay': '0',
													'p:tgtEl': {
														'p:spTgt': {
															'@_spid': 'triggerButton',
														},
													},
												},
											},
											'p:childTnLst': {
												'p:par': {
													'p:cTn': {
														'@_id': '11',
														'@_presetID': '1',
														'@_presetClass': 'entr',
														'@_dur': '250',
														'p:childTnLst': {
															'p:set': {
																'p:cBhvr': {
																	'p:tgtEl': {
																		'p:spTgt': {
																			'@_spid': 'hiddenShape',
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
								],
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result!.length).toBeGreaterThanOrEqual(2);

			// Find the interactive animation
			const interactiveAnim = result!.find((a) => a.trigger === 'onShapeClick');
			expect(interactiveAnim).toBeDefined();
			expect(interactiveAnim!.triggerShapeId).toBe('triggerButton');
			expect(interactiveAnim!.targetId).toBe('hiddenShape');

			// The interactive effect must appear EXACTLY ONCE. The generic timing
			// walk used to descend into the interactive `p:seq` as well, emitting a
			// second copy tagged with the inherited main-sequence `onClick`
			// trigger. That phantom copy became an extra MAIN-sequence click step,
			// so pressing Next in a slide show burned a click doing nothing instead
			// of advancing the slide.
			const hiddenShapeAnims = result!.filter((a) => a.targetId === 'hiddenShape');
			expect(hiddenShapeAnims).toHaveLength(1);
			expect(hiddenShapeAnims[0].trigger).toBe('onShapeClick');
		});

		it('does not emit an interactive effect as a main-sequence click step', () => {
			// Shape of `e2e/fixtures/solution-explorer.pptx` slide 2: a mainSeq that
			// auto-plays a video plus an interactiveSeq that toggles pause when the
			// video itself is clicked. PowerPoint advances to the next slide on the
			// first Next press; the duplicated interactive step made it take two.
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:seq': [
									{
										'p:cTn': {
											'@_id': '2',
											'@_nodeType': 'mainSeq',
											'p:childTnLst': {
												'p:par': {
													'p:cTn': {
														'@_id': '3',
														'@_nodeType': 'afterEffect',
														'@_presetID': '1',
														'@_presetClass': 'mediacall',
														'p:childTnLst': {
															'p:cmd': {
																'@_type': 'call',
																'@_cmd': 'playFrom(0.0)',
																'p:cBhvr': {
																	'p:tgtEl': { 'p:spTgt': { '@_spid': 'video' } },
																},
															},
														},
													},
												},
											},
										},
									},
									{
										'p:cTn': {
											'@_id': '8',
											'@_nodeType': 'interactiveSeq',
											'p:stCondLst': {
												'p:cond': {
													'@_evt': 'onClick',
													'@_delay': '0',
													'p:tgtEl': { 'p:spTgt': { '@_spid': 'video' } },
												},
											},
											'p:childTnLst': {
												'p:par': {
													'p:cTn': {
														'@_id': '11',
														'@_nodeType': 'clickEffect',
														'@_presetID': '2',
														'@_presetClass': 'mediacall',
														'p:childTnLst': {
															'p:cmd': {
																'@_type': 'call',
																'@_cmd': 'togglePause',
																'p:cBhvr': {
																	'p:tgtEl': { 'p:spTgt': { '@_spid': 'video' } },
																},
															},
														},
													},
												},
											},
										},
									},
								],
							},
						},
					},
				},
			});

			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();

			const toggles = result!.filter((a) => a.commandString === 'togglePause');
			expect(toggles).toHaveLength(1);
			expect(toggles[0].trigger).toBe('onShapeClick');
			expect(toggles[0].triggerShapeId).toBe('video');

			// The only main-sequence effect is the auto-started playback command.
			// Its `nodeType="afterEffect"` (PowerPoint's "Start: After Previous")
			// means it plays automatically once the sequence begins, not on a
			// click - it must not collide with the interactive `onShapeClick`
			// trigger asserted above.
			const mainSeqAnims = result!.filter((a) => a.trigger === 'afterPrevious');
			expect(mainSeqAnims).toHaveLength(1);
			expect(mainSeqAnims[0].commandString).toBe('playFrom(0.0)');
		});

		it('still finds an interactive sequence nested below the root', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'p:childTnLst': {
											'p:seq': {
												'p:cTn': {
													'@_id': '3',
													'@_nodeType': 'interactiveSeq',
													'p:stCondLst': {
														'p:cond': {
															'@_evt': 'onClick',
															'p:tgtEl': { 'p:spTgt': { '@_spid': 'deepTrigger' } },
														},
													},
													'p:childTnLst': {
														'p:par': {
															'p:cTn': {
																'@_id': '4',
																'@_presetID': '1',
																'@_presetClass': 'entr',
																'p:childTnLst': {
																	'p:set': {
																		'p:cBhvr': {
																			'p:tgtEl': { 'p:spTgt': { '@_spid': 'deepTarget' } },
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
			});

			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			const deep = result!.filter((a) => a.targetId === 'deepTarget');
			expect(deep).toHaveLength(1);
			expect(deep[0].trigger).toBe('onShapeClick');
			expect(deep[0].triggerShapeId).toBe('deepTrigger');
		});

		it('skips mainSeq sequences in interactive parsing', () => {
			const slideXml = buildSlideXmlWithTiming({
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
													'@_presetID': '10',
													'@_presetClass': 'entr',
													'@_dur': '500',
													'p:childTnLst': {
														'p:animEffect': {
															'p:cBhvr': {
																'p:tgtEl': {
																	'p:spTgt': {
																		'@_spid': 'shape1',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			// All animations should be from main sequence, none onShapeClick
			for (const anim of result!) {
				expect(anim.trigger).not.toBe('onShapeClick');
			}
		});
	});

	// -----------------------------------------------------------------------
	// Timing attributes: @fill / @restart / @repeatDur / @spd (effect cTn),
	// @rev / @advAuto (text p:bldP), @concurrent / @nextAc / @prevAc (p:seq)
	// -----------------------------------------------------------------------
	describe('timing attributes (animation-timing-attrs)', () => {
		it('extracts @fill, @restart, @repeatDur and @spd from the effect cTn', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:seq': {
									'@_concurrent': '1',
									'@_nextAc': 'seek',
									'@_prevAc': 'skipTimeNode',
									'p:cTn': {
										'@_id': '2',
										'@_dur': 'indefinite',
										'@_nodeType': 'mainSeq',
										'p:childTnLst': {
											'p:par': {
												'p:cTn': {
													'@_id': '3',
													'@_presetID': '10',
													'@_presetClass': 'emph',
													'@_dur': '500',
													'@_fill': 'hold',
													'@_restart': 'never',
													'@_repeatDur': '1500',
													'@_spd': '150000',
													'p:childTnLst': {
														'p:animEffect': {
															'p:cBhvr': {
																'p:tgtEl': {
																	'p:spTgt': {
																		'@_spid': 'timedShape',
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
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			const anim = result!.find((a) => a.targetId === 'timedShape');
			expect(anim).toBeDefined();
			expect(anim!.fill).toBe('hold');
			expect(anim!.restart).toBe('never');
			expect(anim!.repeatDurMs).toBe(1500);
			expect(anim!.speedPct).toBe(150);
			expect(anim!.seqConcurrent).toBeTruthy();
			expect(anim!.seqNextAction).toBe('seek');
			expect(anim!.seqPrevAction).toBe('skipTimeNode');
		});

		it('parses @repeatDur="indefinite" as Infinity', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'emph',
										'@_dur': '500',
										'@_repeatDur': 'indefinite',
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': { 'p:spTgt': { '@_spid': 'infShape' } },
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result![0].repeatDurMs).toBe(Infinity);
		});

		it('leaves fill/restart/repeatDurMs/speedPct undefined when absent', () => {
			const result = service.parseNativeAnimations(buildSimpleEntranceSlide('plainShape'));
			expect(result).toBeDefined();
			expect(result![0].fill).toBeUndefined();
			expect(result![0].repeatDurMs).toBeUndefined();
			expect(result![0].speedPct).toBeUndefined();
		});

		it('extracts @rev and @advAuto from a TEXT p:bldP, distinct from p:bldDgm/@rev', () => {
			const slideXml = buildSlideXmlWithTiming({
				'p:tnLst': {
					'p:par': {
						'p:cTn': {
							'@_id': '1',
							'@_dur': 'indefinite',
							'@_nodeType': 'tmRoot',
							'p:childTnLst': {
								'p:par': {
									'p:cTn': {
										'@_id': '2',
										'@_presetID': '10',
										'@_presetClass': 'entr',
										'@_dur': '500',
										'p:childTnLst': {
											'p:animEffect': {
												'p:cBhvr': {
													'p:tgtEl': { 'p:spTgt': { '@_spid': 'revShape' } },
												},
											},
										},
									},
								},
							},
						},
					},
				},
				'p:bldLst': {
					'p:bldP': {
						'@_spid': 'revShape',
						'@_build': 'p',
						'@_grpId': '0',
						'@_rev': '1',
						'@_advAuto': '2000',
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].buildReverse).toBeTruthy();
			expect(result![0].buildAdvAutoMs).toBe(2000);
		});
	});

	// -----------------------------------------------------------------------
	// Error handling
	// -----------------------------------------------------------------------
	describe('error handling', () => {
		it('returns undefined and does not throw on malformed XML', () => {
			// Circular reference would cause issues in real parsing but the
			// service should catch exceptions
			const slideXml: XmlObject = {
				'p:sld': {
					'p:timing': {
						'p:tnLst': {
							'p:par': null as unknown as XmlObject,
						},
					},
				},
			};
			expect(service.parseNativeAnimations(slideXml)).toBeUndefined();
		});
	});
});
