import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	applySmartArtLayoutDefinition,
	parseSmartArtLayoutDefinition,
	validateSmartArtLayoutDefinition,
} from './smartart-layout-definition';

const localName = (key: string): string => key.split(':').pop() ?? key;

function fixture(): XmlObject {
	return {
		'@_uniqueId': 'urn:old',
		'@_minVer': '12.0',
		'x:title': { '@_lang': 'en-US', '@_val': 'Old title', '@_vendor': 'keep' },
		'x:desc': { '@_val': 'Old description' },
		'x:catLst': { 'x:cat': { '@_type': 'list', '@_pri': 1, '@_custom': 'keep' } },
		'x:layoutNode': {
			'@_name': 'root',
			'@_styleLbl': 'oldStyle',
			'x:alg': {
				'@_type': 'lin',
				'@_rev': 2,
				'x:param': [
					{ '@_type': 'linDir', '@_val': 'fromL', '@_vendor': 'keep' },
					{ '@_type': 'pyraAcctPos', '@_val': 'bef' },
				],
				'x:extLst': { 'a:ext': { '@_uri': '{algorithm-vendor}' } },
			},
			'x:forEach': {
				'@_name': 'items',
				'@_axis': 'ch des',
				'@_hideLastTrans': '0 1',
				'@_st': '-1 0',
				'@_cnt': '2 3',
				'@_step': '1 2',
				'x:shape': { '@_type': 'rect' },
			},
			'x:choose': {
				'@_name': 'branch',
				'x:if': {
					'@_func': 'cnt',
					'@_arg': 'ch',
					'@_op': 'gte',
					'@_val': '2',
					'x:layoutNode': { '@_name': 'chosen' },
				},
				'x:else': { '@_name': 'fallback', 'x:shape': { '@_type': 'ellipse' } },
			},
			'x:layoutNode': { '@_name': 'child', 'x:shape': { '@_type': 'rect' } },
			'x:extLst': { 'a:ext': { '@_uri': '{vendor}' } },
		},
		'x:extLst': { 'a:ext': { '@_uri': '{root-vendor}' } },
	};
}

describe('diagramML layout-definition metadata', () => {
	it('parses CT_DiagramDefinition and recursive CT_LayoutNode with arbitrary prefixes', () => {
		const parsed = parseSmartArtLayoutDefinition(fixture(), localName);
		expect(parsed).toMatchObject({
			uniqueId: 'urn:old',
			minimumVersion: '12.0',
			titles: [{ language: 'en-US', value: 'Old title' }],
			categories: [{ type: 'list', priority: 1 }],
			rootNode: {
				name: 'root',
				styleLabel: 'oldStyle',
				algorithm: {
					type: 'lin',
					revision: 2,
					parameters: [
						{ type: 'linDir', value: 'fromL' },
						{ type: 'pyraAcctPos', value: 'bef' },
					],
				},
				forEach: [
					{
						name: 'items',
						axis: ['ch', 'des'],
						hideLastTransition: [false, true],
						start: [-1, 0],
						count: [2, 3],
						step: [1, 2],
					},
				],
				choose: [
					{
						name: 'branch',
						when: [{ function: 'cnt', argument: 'ch', operator: 'gte', value: '2' }],
						otherwise: { name: 'fallback' },
					},
				],
				children: [{ name: 'chosen' }, { name: 'child' }],
			},
		});
	});

	it('surgically edits typed fields and preserves algorithms, unknown data, and extLst', () => {
		const xml = fixture();
		const value = parseSmartArtLayoutDefinition(xml, localName)!;
		value.uniqueId = 'urn:new';
		value.defaultStyle = 'urn:style';
		value.titles = [{ language: 'fr-FR', value: 'Nouveau' }];
		value.categories = [{ type: 'process', priority: 7 }];
		value.rootNode.styleLabel = 'newStyle';
		value.rootNode.childOrder = 't';
		value.rootNode.algorithm = {
			type: 'snake',
			revision: 3,
			parameters: [{ type: 'grDir', value: 'tR' }],
		};
		value.rootNode.forEach![0].count = [4];
		value.rootNode.choose![0].when[0].value = '3';
		value.rootNode.choose![0].otherwise = null;
		value.rootNode.children![1].moveWith = 'root';

		expect(applySmartArtLayoutDefinition(xml, value, localName)).toBeTruthy();
		expect(xml).toMatchObject({
			'@_uniqueId': 'urn:new',
			'@_defStyle': 'urn:style',
			'x:title': [{ '@_lang': 'fr-FR', '@_val': 'Nouveau', '@_vendor': 'keep' }],
			'x:catLst': { 'x:cat': [{ '@_type': 'process', '@_pri': '7', '@_custom': 'keep' }] },
			'x:layoutNode': {
				'@_styleLbl': 'newStyle',
				'@_chOrder': 't',
				'x:alg': {
					'@_type': 'snake',
					'@_rev': '3',
					'x:param': [{ '@_type': 'grDir', '@_val': 'tR', '@_vendor': 'keep' }],
					'x:extLst': { 'a:ext': { '@_uri': '{algorithm-vendor}' } },
				},
				'x:forEach': [
					{
						'@_cnt': '4',
						'x:shape': { '@_type': 'rect' },
					},
				],
				'x:choose': [
					{
						'x:if': [
							{
								'@_val': '3',
								'x:layoutNode': { '@_name': 'chosen' },
							},
						],
					},
				],
				'x:layoutNode': { '@_moveWith': 'root', 'x:shape': { '@_type': 'rect' } },
				'x:extLst': { 'a:ext': { '@_uri': '{vendor}' } },
			},
			'x:extLst': { 'a:ext': { '@_uri': '{root-vendor}' } },
		});
	});

	it('creates and removes CT_Algorithm in CT_LayoutNode schema order', () => {
		const xml: XmlObject = {
			'@_name': 'root',
			'x:shape': { '@_type': 'rect' },
			'x:extLst': { 'a:ext': { '@_uri': '{vendor}' } },
		};
		const definition: XmlObject = { 'x:layoutNode': xml };
		const value = parseSmartArtLayoutDefinition(definition, localName)!;
		value.rootNode.algorithm = {
			type: 'cycle',
			parameters: [{ type: 'stElem', value: 'node' }],
		};

		expect(applySmartArtLayoutDefinition(definition, value, localName)).toBeTruthy();
		expect(Object.keys(xml)).toStrictEqual(['@_name', 'dgm:alg', 'x:shape', 'x:extLst']);
		expect(xml['dgm:alg']).toMatchObject({
			'@_type': 'cycle',
			'dgm:param': [{ '@_type': 'stElem', '@_val': 'node' }],
		});

		value.rootNode.algorithm = undefined;
		expect(applySmartArtLayoutDefinition(definition, value, localName)).toBeTruthy();
		expect(xml['dgm:alg']).toBeUndefined();
	});

	it('creates and removes typed forEach and choose branches', () => {
		const definition: XmlObject = { 'x:layoutNode': { '@_name': 'root' } };
		const value = parseSmartArtLayoutDefinition(definition, localName)!;
		value.rootNode.forEach = [{ reference: 'parent', pointTypes: ['node'], count: [1] }];
		value.rootNode.choose = [
			{
				when: [{ function: 'var', operator: 'equ', value: 'true' }],
				otherwise: { name: 'fallback' },
			},
		];

		expect(applySmartArtLayoutDefinition(definition, value, localName)).toBeTruthy();
		expect(definition['x:layoutNode']).toMatchObject({
			'dgm:forEach': [{ '@_ref': 'parent', '@_ptType': 'node', '@_cnt': '1' }],
			'dgm:choose': [
				{
					'dgm:if': [{ '@_func': 'var', '@_op': 'equ', '@_val': 'true' }],
					'dgm:else': { '@_name': 'fallback' },
				},
			],
		});

		value.rootNode.forEach = [];
		value.rootNode.choose = [];
		expect(applySmartArtLayoutDefinition(definition, value, localName)).toBeTruthy();
		expect(definition['x:layoutNode']).toStrictEqual({ '@_name': 'root' });
	});

	it('rejects invalid required values and unsigned integer facets', () => {
		expect(
			validateSmartArtLayoutDefinition({
				rootNode: {
					algorithm: {
						type: '',
						revision: -1,
						parameters: [{ type: '' }],
					},
					choose: [{ when: [{ function: '', operator: '', value: '' }] }],
					forEach: [{ count: [-1], start: [2_147_483_648], step: [] }],
				},
				titles: [{ value: ' ' }],
				categories: [{ type: '', priority: 4294967296 }],
			}),
		).toStrictEqual([
			'rootNode.algorithm.type is required',
			'rootNode.algorithm.revision must be an unsigned 32-bit integer',
			'rootNode.algorithm.parameters[0].type is required',
			'rootNode.forEach[0].start values must be signed 32-bit integers',
			'rootNode.forEach[0].count values must be unsigned 32-bit integers',
			'rootNode.choose[0].when[0].function is required',
			'rootNode.choose[0].when[0].operator is required',
			'rootNode.choose[0].when[0].value is required',
			'categories[0].type is required',
			'categories[0].priority must be an unsigned 32-bit integer',
			'titles[0].value is required',
		]);
	});
});
