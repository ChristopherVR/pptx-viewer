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
			'x:alg': { '@_type': 'lin' },
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
			rootNode: { name: 'root', styleLabel: 'oldStyle', children: [{ name: 'child' }] },
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
				'x:alg': { '@_type': 'lin' },
				'x:layoutNode': { '@_moveWith': 'root', 'x:shape': { '@_type': 'rect' } },
				'x:extLst': { 'a:ext': { '@_uri': '{vendor}' } },
			},
			'x:extLst': { 'a:ext': { '@_uri': '{root-vendor}' } },
		});
	});

	it('rejects invalid required values and unsigned integer facets', () => {
		expect(
			validateSmartArtLayoutDefinition({
				rootNode: {},
				titles: [{ value: ' ' }],
				categories: [{ type: '', priority: 4294967296 }],
			}),
		).toStrictEqual([
			'categories[0].type is required',
			'categories[0].priority must be an unsigned 32-bit integer',
			'titles[0].value is required',
		]);
	});
});
