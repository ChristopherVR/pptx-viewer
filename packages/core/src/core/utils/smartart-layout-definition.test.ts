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
				children: [{ name: 'child' }],
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
		value.rootNode.children![0].moveWith = 'root';

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

	it('rejects invalid required values and unsigned integer facets', () => {
		expect(
			validateSmartArtLayoutDefinition({
				rootNode: {
					algorithm: {
						type: '',
						revision: -1,
						parameters: [{ type: '' }],
					},
				},
				titles: [{ value: ' ' }],
				categories: [{ type: '', priority: 4294967296 }],
			}),
		).toStrictEqual([
			'rootNode.algorithm.type is required',
			'rootNode.algorithm.revision must be an unsigned 32-bit integer',
			'rootNode.algorithm.parameters[0].type is required',
			'categories[0].type is required',
			'categories[0].priority must be an unsigned 32-bit integer',
			'titles[0].value is required',
		]);
	});
});
