import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	extractGraphicBuilds,
	parseTimeTargetElement,
	serializeGraphicBuild,
	serializeTimeTargetElement,
} from './animation-target-build-helpers';
import { parseCondition, serializeCondition } from './native-animation-helpers';
import { PptxNativeAnimationService } from './PptxNativeAnimationService';

describe('presentationML timing target choices', () => {
	it('round-trips a sound target and unknown XML', () => {
		const xml: XmlObject = {
			'p:sndTgt': { '@_r:embed': 'rId9', '@_name': 'Chime', '@_future': 'kept' },
		};
		const parsed = parseTimeTargetElement(xml);
		expect(parsed).toMatchObject({
			type: 'sound',
			relationshipId: 'rId9',
			name: 'Chime',
		});
		expect(serializeTimeTargetElement(parsed!)).toStrictEqual(xml);
	});

	it('round-trips an ink target', () => {
		const xml: XmlObject = { 'p:inkTgt': { '@_spid': '42' } };
		const parsed = parseTimeTargetElement(xml);
		expect(parsed).toMatchObject({ type: 'ink', shapeId: '42' });
		expect(serializeTimeTargetElement(parsed!)).toStrictEqual(xml);
	});

	it('preserves an unmodelled target choice', () => {
		const xml: XmlObject = { 'p:futureTgt': { '@_id': 'x' } };
		const parsed = parseTimeTargetElement(xml);
		expect(parsed?.type).toBe('unknown');
		expect(serializeTimeTargetElement(parsed!)).toStrictEqual(xml);
	});

	it.each([
		[
			'sound',
			{ 'p:sndTgt': { '@_r:embed': 'rId3', '@_name': 'Bell' } },
			{ type: 'sound', relationshipId: 'rId3', name: 'Bell' },
		],
		['ink', { 'p:inkTgt': { '@_spid': '12' } }, { type: 'ink', shapeId: '12' }],
	] as const)('round-trips %s condition targets', (_name, targetXml, expected) => {
		const xml: XmlObject = { '@_evt': 'onBegin', 'p:tgtEl': targetXml };
		const parsed = parseCondition(xml);
		expect(parsed.target).toMatchObject(expected);
		expect(serializeCondition(parsed)).toStrictEqual(xml);
	});

	it.each([
		[
			'sound',
			{ 'p:sndTgt': { '@_r:embed': 'rId8', '@_name': 'Ping' } },
			{ type: 'sound', relationshipId: 'rId8', name: 'Ping' },
		],
		['ink', { 'p:inkTgt': { '@_spid': '21' } }, { type: 'ink', shapeId: '21' }],
	] as const)('parses %s targets from native effect behaviors', (_name, targetXml, expected) => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:timing': {
					'p:tnLst': {
						'p:par': {
							'p:cTn': {
								'@_id': '1',
								'p:childTnLst': {
									'p:par': {
										'p:cTn': {
											'@_id': '2',
											'@_presetClass': 'entr',
											'@_presetID': '1',
											'p:childTnLst': {
												'p:animEffect': {
													'p:cBhvr': { 'p:tgtEl': targetXml },
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
		const animation = new PptxNativeAnimationService().parseNativeAnimations(slideXml)?.[0];
		expect(animation?.target).toMatchObject(expected);
	});
});

describe('presentationML graphical object builds', () => {
	it('round-trips bldAsOne and unknown XML', () => {
		const xml: XmlObject = {
			'@_spid': '7',
			'@_grpId': '2',
			'@_future': 'kept',
			'p:bldAsOne': {},
		};
		const entry = extractGraphicBuilds({ 'p:bldGraphic': xml })[0];
		expect(entry.build.mode).toBe('asOne');
		expect(serializeGraphicBuild(entry)).toStrictEqual(xml);
	});

	it('round-trips nested diagram build properties', () => {
		const xml: XmlObject = {
			'@_spid': '8',
			'@_grpId': '4',
			'p:bldSub': {
				'a:bldDgm': { '@_bld': 'lvlAtOnce', '@_rev': '1', '@_future': 'kept' },
			},
		};
		const entry = extractGraphicBuilds({ 'p:bldGraphic': xml })[0];
		expect(entry.build).toMatchObject({
			mode: 'sub',
			kind: 'diagram',
			build: 'lvlAtOnce',
			reverse: true,
		});
		expect(serializeGraphicBuild(entry)).toStrictEqual(xml);
	});

	it('applies schema defaults to nested chart build properties', () => {
		const entry = extractGraphicBuilds({
			'p:bldGraphic': {
				'@_spid': '9',
				'@_grpId': '5',
				'p:bldSub': { 'a:bldChart': {} },
			},
		})[0];
		expect(entry.build).toMatchObject({
			mode: 'sub',
			kind: 'chart',
			build: 'allAtOnce',
			animateBackground: true,
		});
	});

	it('attaches typed bldSub properties to native animations', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:timing': {
					'p:tnLst': {
						'p:par': {
							'p:cTn': {
								'p:childTnLst': {
									'p:par': {
										'p:cTn': {
											'@_presetClass': 'entr',
											'p:childTnLst': {
												'p:animEffect': {
													'p:cBhvr': {
														'p:tgtEl': { 'p:spTgt': { '@_spid': '30' } },
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
						'p:bldGraphic': {
							'@_spid': '30',
							'@_grpId': '6',
							'p:bldSub': {
								'a:bldChart': { '@_bld': 'category', '@_animBg': '0' },
							},
						},
					},
				},
			},
		};
		const animation = new PptxNativeAnimationService().parseNativeAnimations(slideXml)?.[0];
		expect(animation?.graphicBuildProperties).toMatchObject({
			mode: 'sub',
			kind: 'chart',
			build: 'category',
			animateBackground: false,
		});
		expect(animation?.groupId).toBe('6');
	});
});
