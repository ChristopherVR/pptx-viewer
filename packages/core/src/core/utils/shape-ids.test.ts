import { describe, it, expect } from 'vitest';

import type { ConnectorPptxElement, GroupPptxElement, ShapePptxElement, XmlObject } from '../types';
import {
	MAX_SHAPE_ID,
	findCnvPrNode,
	parseShapeId,
	remapElementShapeIds,
	remapShapeIdReferences,
	visitXmlObjects,
} from './shape-ids';

function shape(id: string, overrides: Partial<ShapePptxElement> = {}): ShapePptxElement {
	return {
		id: `el-${id}`,
		type: 'shape',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		rawXml: { 'p:nvSpPr': { 'p:cNvPr': { '@_id': id, '@_name': `Shape ${id}` } } },
		...overrides,
	} as ShapePptxElement;
}

describe('parseShapeId', () => {
	it('accepts every UInt32 in range', () => {
		expect(parseShapeId('1')).toBe(1);
		expect(parseShapeId(' 42 ')).toBe(42);
		expect(parseShapeId(String(MAX_SHAPE_ID))).toBe(MAX_SHAPE_ID);
		expect(parseShapeId(7)).toBe(7);
	});

	it('rejects zero unless allowed', () => {
		expect(parseShapeId('0')).toBeUndefined();
		expect(parseShapeId('0', true)).toBe(0);
	});

	it('rejects non-integer, negative, decimal and out-of-range values', () => {
		expect(parseShapeId('abc')).toBeUndefined();
		expect(parseShapeId('-1')).toBeUndefined();
		expect(parseShapeId('1.5')).toBeUndefined();
		expect(parseShapeId('1e3')).toBeUndefined();
		expect(parseShapeId('')).toBeUndefined();
		expect(parseShapeId(undefined)).toBeUndefined();
		expect(parseShapeId(null)).toBeUndefined();
		expect(parseShapeId('4294967296')).toBeUndefined();
		expect(parseShapeId('1788524999615')).toBeUndefined();
	});
});

describe('visitXmlObjects', () => {
	it('visits every object node with its tag, skipping attributes', () => {
		const tags: string[] = [];
		visitXmlObjects(
			{ 'p:a': [{ 'p:b': { '@_x': '1' } }, { 'p:c': {} }], '@_attr': { ignored: true } },
			(_node, tag) => tags.push(tag),
		);
		expect(tags).toStrictEqual(['', 'p:a', 'p:b', 'p:a', 'p:c']);
	});
});

describe('remapShapeIdReferences', () => {
	const ids = new Map([['5', '9']]);

	it('rewrites connector connection sites', () => {
		const root: XmlObject = {
			'p:cNvCxnSpPr': { 'a:stCxn': { '@_id': '5', '@_idx': '0' }, 'a:endCxn': { '@_id': '6' } },
		};
		remapShapeIdReferences(root, ids);
		const props = root['p:cNvCxnSpPr'] as XmlObject;
		expect((props['a:stCxn'] as XmlObject)['@_id']).toBe('9');
		expect((props['a:endCxn'] as XmlObject)['@_id']).toBe('6');
	});

	it('rewrites timing targets, build nodes and ActiveX controls by @spid', () => {
		const root: XmlObject = {
			'p:timing': {
				'p:tnLst': { 'p:tgtEl': { 'p:spTgt': { '@_spid': '5' }, 'p:inkTgt': { '@_spid': '5' } } },
				'p:bldLst': {
					'p:bldP': [{ '@_spid': '5' }, { '@_spid': '2' }],
					'p:bldOleChart': { '@_spid': '5' },
					'p:bldDgm': { '@_spid': '5' },
					'p:bldGraphic': { '@_spid': '5' },
				},
			},
			'p:controls': { 'p:control': { '@_spid': '5', '@_name': 'Ctl' } },
		};
		remapShapeIdReferences(root, ids);
		const timing = root['p:timing'] as XmlObject;
		const tgtEl = (timing['p:tnLst'] as XmlObject)['p:tgtEl'] as XmlObject;
		expect((tgtEl['p:spTgt'] as XmlObject)['@_spid']).toBe('9');
		expect((tgtEl['p:inkTgt'] as XmlObject)['@_spid']).toBe('9');
		const bld = timing['p:bldLst'] as XmlObject;
		expect((bld['p:bldP'] as XmlObject[]).map((n) => n['@_spid'])).toStrictEqual(['9', '2']);
		for (const key of ['p:bldOleChart', 'p:bldDgm', 'p:bldGraphic']) {
			expect((bld[key] as XmlObject)['@_spid']).toBe('9');
		}
		const control = (root['p:controls'] as XmlObject)['p:control'] as XmlObject;
		expect(control['@_spid']).toBe('9');
	});

	it('rewrites the pptx:animation extension attributes', () => {
		const root: XmlObject = {
			'pptx:animations': {
				'pptx:animation': [
					{ '@_elementId': '5', '@_triggerShapeId': '5', '@_entrance': 'fadeIn' },
					{ '@_elementId': '2' },
				],
			},
		};
		remapShapeIdReferences(root, ids);
		const anims = (root['pptx:animations'] as XmlObject)['pptx:animation'] as XmlObject[];
		expect(anims[0]['@_elementId']).toBe('9');
		expect(anims[0]['@_triggerShapeId']).toBe('9');
		expect(anims[1]['@_elementId']).toBe('2');
	});

	it('never touches relationship ids, slide ids, timing-node ids, sub-shapes or declarations', () => {
		const root: XmlObject = {
			'p:cNvPr': { '@_id': '5' },
			'p:sldId': { '@_id': '5', '@_r:id': '5' },
			'p:cTn': { '@_id': '5' },
			'p:spTgt': { '@_spid': '5', 'p:subSp': { '@_spid': '5' } },
			'a:blip': { '@_r:embed': '5' },
		};
		remapShapeIdReferences(root, ids);
		expect((root['p:cNvPr'] as XmlObject)['@_id']).toBe('5');
		expect((root['p:sldId'] as XmlObject)['@_id']).toBe('5');
		expect((root['p:cTn'] as XmlObject)['@_id']).toBe('5');
		expect(((root['p:spTgt'] as XmlObject)['p:subSp'] as XmlObject)['@_spid']).toBe('5');
		expect((root['a:blip'] as XmlObject)['@_r:embed']).toBe('5');
	});

	it('is idempotent and a no-op for an empty map', () => {
		const root: XmlObject = { 'p:spTgt': { '@_spid': '5' } };
		remapShapeIdReferences(root, new Map());
		expect((root['p:spTgt'] as XmlObject)['@_spid']).toBe('5');
		remapShapeIdReferences(root, ids);
		remapShapeIdReferences(root, ids);
		expect((root['p:spTgt'] as XmlObject)['@_spid']).toBe('9');
	});
});

describe('findCnvPrNode', () => {
	it('finds p: and p14: declarations and tolerates missing rawXml', () => {
		expect(findCnvPrNode(undefined)).toBeUndefined();
		expect(findCnvPrNode({ 'p:spPr': {} })).toBeUndefined();
		const p14 = { 'p14:nvContentPartPr': { 'p14:cNvPr': { '@_id': '3' } } };
		expect(findCnvPrNode(p14)?.['@_id']).toBe('3');
	});
});

describe('remapElementShapeIds', () => {
	it('syncs shapeId with a declaration the validator renumbered in place', () => {
		const el = shape('9', { shapeId: '5' });
		expect(remapElementShapeIds([el], new Map([['5', '9']]))).toBe(1);
		expect(el.shapeId).toBe('9');
	});

	it('renumbers a lone detached holder of a remapped id, including its raw declaration', () => {
		const el = shape('1788524999615', { shapeId: '1788524999615' });
		expect(remapElementShapeIds([el], new Map([['1788524999615', '3']]))).toBe(1);
		expect(el.shapeId).toBe('3');
		expect(findCnvPrNode(el.rawXml as XmlObject)?.['@_id']).toBe('3');
	});

	it('keeps the first of several detached holders and renumbers the rest', () => {
		const first = shape('5', { shapeId: '5' });
		const second = shape('5', { id: 'el-5b', shapeId: '5' });
		const third = { ...shape('5', { id: 'el-5c' }), rawXml: undefined, shapeId: '5' };
		expect(remapElementShapeIds([first, second, third], new Map([['5', '9']]))).toBe(2);
		expect(first.shapeId).toBe('5');
		expect(second.shapeId).toBe('9');
		expect(findCnvPrNode(second.rawXml as XmlObject)?.['@_id']).toBe('9');
		expect(third.shapeId).toBe('9');
	});

	it('rewrites references inside rawXml and connector connection points, recursing into groups', () => {
		const connector = {
			id: 'cxn',
			type: 'connector',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			rawXml: {
				'p:nvCxnSpPr': {
					'p:cNvPr': { '@_id': '8' },
					'p:cNvCxnSpPr': { 'a:stCxn': { '@_id': '5', '@_idx': '1' } },
				},
			},
			shapeStyle: {
				connectorStartConnection: { shapeId: '5', connectionSiteIndex: 1 },
				connectorEndConnection: { shapeId: '6', connectionSiteIndex: 0 },
			},
		} as ConnectorPptxElement;
		const group = {
			id: 'grp',
			type: 'group',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			children: [connector],
		} as GroupPptxElement;
		expect(remapElementShapeIds([group], new Map([['5', '9']]))).toBe(1);
		const cxnProps = (connector.rawXml as XmlObject)['p:nvCxnSpPr'] as XmlObject;
		const stCxn = (cxnProps['p:cNvCxnSpPr'] as XmlObject)['a:stCxn'] as XmlObject;
		expect(stCxn['@_id']).toBe('9');
		expect(connector.shapeStyle?.connectorStartConnection?.shapeId).toBe('9');
		expect(connector.shapeStyle?.connectorEndConnection?.shapeId).toBe('6');
	});

	it('is a no-op for an empty map', () => {
		const el = shape('5', { shapeId: '5' });
		expect(remapElementShapeIds([el], new Map())).toBe(0);
		expect(el.shapeId).toBe('5');
	});
});
