import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import {
	applyChartAxisTitleToXml,
	applyChartAxisTitleStyleToXml,
} from './chart-axis-title-serializer';
import { collectAllText } from './chart-title-xml-ops';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

/** A value axis with id, scaling, position, and a number format (no title). */
function axisNode(): XmlObject {
	return {
		'c:axId': { '@_val': '1' },
		'c:scaling': {},
		'c:axPos': { '@_val': 'l' },
		'c:numFmt': { '@_formatCode': 'General' },
	};
}

/** An existing title carrying the given text. */
function titleWith(text: string): XmlObject {
	return {
		'c:tx': { 'c:rich': { 'a:p': { 'a:r': { 'a:t': text } } } },
		'c:overlay': { '@_val': '0' },
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyChartAxisTitleToXml', () => {
	const runProperties: XmlObject = {
		'@_lang': 'en-US',
		'a:solidFill': { 'a:schemeClr': { '@_val': 'accent2' } },
		'a:latin': { '@_typeface': '+mj-lt' },
	};
	const paragraphProperties: XmlObject = { '@_algn': 'ctr' };

	function richTitle(paragraphs: XmlObject | XmlObject[]): XmlObject {
		return {
			'c:tx': {
				'c:rich': {
					'a:bodyPr': { '@_rot': '-5400000' },
					'a:lstStyle': {},
					'a:p': paragraphs,
				},
			},
			'c:layout': { 'c:manualLayout': { 'c:x': { '@_val': '0.1' } } },
			'c:overlay': { '@_val': '1' },
			'c:spPr': { 'a:noFill': {} },
			'c:txPr': { 'a:bodyPr': {}, 'a:p': { 'a:pPr': { 'a:defRPr': { '@_sz': '1400' } } } },
		};
	}

	function richBody(title: XmlObject): XmlObject {
		return (title['c:tx'] as XmlObject)['c:rich'] as XmlObject;
	}

	it.each([
		{ 'a:r': [{ 'a:rPr': runProperties, 'a:t': 'Value ' }, { 'a:t': 'Axis' }] },
		{ 'a:r': { 'a:t': 'Value ' }, 'a:fld': { '@_id': 'field', 'a:t': 'Axis' } },
	])('preserves an unchanged rich title without duplicating text', (paragraph) => {
		const node = { ...axisNode(), 'c:title': richTitle(paragraph) };
		const before = structuredClone(node);
		const title = node['c:title'];
		applyChartAxisTitleToXml(node, 'Value Axis', getLocalName);
		expect(node).toStrictEqual(before);
		expect(node['c:title']).toBe(title);
	});

	it.each([
		{
			'a:pPr': paragraphProperties,
			'a:r': [{ 'a:rPr': runProperties, 'a:t': 'Value ' }, { 'a:t': 'Axis' }],
			'a:endParaRPr': { '@_lang': 'en-US' },
		},
		{
			'a:pPr': paragraphProperties,
			'a:fld': { '@_id': 'field', '@_type': 'slidenum', 'a:rPr': runProperties, 'a:t': '1' },
			'a:r': { 'a:t': ' Axis' },
			'a:endParaRPr': { '@_lang': 'en-US' },
		},
		{
			'a:pPr': paragraphProperties,
			'a:r': { 'a:rPr': runProperties, 'a:t': 'Value' },
			'a:br': {},
			'a:endParaRPr': { '@_lang': 'en-US' },
		},
	])(
		'replaces changed rich content with one literal run while retaining its raw style',
		(paragraph) => {
			const title = richTitle(paragraph);
			const node = { ...axisNode(), 'c:title': title };
			const original = structuredClone(title);
			applyChartAxisTitleToXml(node, 'Edited axis', getLocalName);
			const texts: string[] = [];
			collectAllText(title, getLocalName, texts);
			expect(texts).toStrictEqual(['Edited axis']);
			expect(richBody(title)['a:p']).toStrictEqual({
				'a:pPr': paragraphProperties,
				'a:r': { 'a:rPr': runProperties, 'a:t': 'Edited axis' },
				'a:endParaRPr': { '@_lang': 'en-US' },
			});
			expect(Object.keys(richBody(title)['a:p'] as XmlObject)).toStrictEqual([
				'a:pPr',
				'a:r',
				'a:endParaRPr',
			]);
			for (const key of ['c:layout', 'c:overlay', 'c:spPr', 'c:txPr']) {
				expect(title[key]).toStrictEqual(original[key]);
			}
			expect(richBody(title)['a:bodyPr']).toStrictEqual(richBody(original)['a:bodyPr']);
			const once = structuredClone(node);
			applyChartAxisTitleToXml(node, 'Edited axis', getLocalName);
			expect(node).toStrictEqual(once);
		},
	);

	it('removes extra paragraphs on a flat edit and preserves attributed boundary whitespace', () => {
		const title = richTitle([
			{
				'a:pPr': paragraphProperties,
				'a:r': { 'a:rPr': runProperties, 'a:t': { '@_xml:space': 'preserve', '#text': 'Value ' } },
			},
			{ 'a:r': { 'a:t': 'Axis' } },
		]);
		const node = { ...axisNode(), 'c:title': title };
		applyChartAxisTitleToXml(node, ' Edited axis ', getLocalName);
		const paragraph = richBody(title)['a:p'] as XmlObject;
		expect(Array.isArray(paragraph)).toBeFalsy();
		expect(paragraph['a:pPr']).toStrictEqual(paragraphProperties);
		expect((paragraph['a:r'] as XmlObject)['a:t']).toStrictEqual({
			'@_xml:space': 'preserve',
			'#text': ' Edited axis ',
		});
	});

	it('turns a lone field into literal text without changing primitive boundary-space representation', () => {
		const title = richTitle({
			'a:fld': { '@_id': 'field', '@_type': 'slidenum', 'a:rPr': runProperties, 'a:t': '1' },
		});
		applyChartAxisTitleToXml({ 'c:title': title }, ' New ', getLocalName);
		expect(richBody(title)['a:p']).toStrictEqual({
			'a:r': { 'a:rPr': runProperties, 'a:t': ' New ' },
		});
	});

	it('uses the first text-bearing paragraph rather than preceding empty paragraph formatting', () => {
		const title = richTitle([
			{ 'a:pPr': { '@_algn': 'l' } },
			{ 'a:pPr': paragraphProperties, 'a:r': { 'a:rPr': runProperties, 'a:t': 'Axis' } },
		]);
		applyChartAxisTitleToXml({ 'c:title': title }, 'Edited', getLocalName);
		expect(richBody(title)['a:p']).toStrictEqual({
			'a:pPr': paragraphProperties,
			'a:r': { 'a:rPr': runProperties, 'a:t': 'Edited' },
		});
	});

	it('replaces a linked title text without discarding the outer title properties', () => {
		const title = richTitle({});
		title['c:tx'] = { 'c:strRef': { 'c:f': 'Sheet1!$A$1' } };
		const original = structuredClone(title);
		const node = { ...axisNode(), 'c:title': title };
		applyChartAxisTitleToXml(node, 'Literal title', getLocalName);
		expect(node['c:title']).toBe(title);
		expect((title['c:tx'] as XmlObject)['c:strRef']).toBeUndefined();
		for (const key of ['c:layout', 'c:overlay', 'c:spPr', 'c:txPr']) {
			expect(title[key]).toStrictEqual(original[key]);
		}
		const texts: string[] = [];
		collectAllText(title, getLocalName, texts);
		expect(texts).toStrictEqual(['Literal title']);
	});

	it('inserts missing text before existing layout and style properties', () => {
		const title = richTitle({});
		delete title['c:tx'];
		const original = structuredClone(title);
		applyChartAxisTitleToXml({ 'c:title': title }, 'Added title', getLocalName);
		expect(Object.keys(title)).toStrictEqual(['c:tx', ...Object.keys(original)]);
		for (const key of Object.keys(original)) {
			expect(title[key]).toStrictEqual(original[key]);
		}
		const texts: string[] = [];
		collectAllText(title, getLocalName, texts);
		expect(texts).toStrictEqual(['Added title']);
	});

	it('is a no-op when titleText is undefined', () => {
		const node = axisNode();
		const before = JSON.stringify(node);
		applyChartAxisTitleToXml(node, undefined, getLocalName);
		expect(JSON.stringify(node)).toBe(before);
	});

	it('inserts a new title before numFmt (schema order)', () => {
		const node = axisNode();
		applyChartAxisTitleToXml(node, 'Revenue', getLocalName);
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('title')).toBeGreaterThan(keys.indexOf('axPos'));
		expect(keys.indexOf('title')).toBeLessThan(keys.indexOf('numFmt'));
	});

	it('sets the text run of a newly inserted title', () => {
		const node = axisNode();
		applyChartAxisTitleToXml(node, 'Revenue', getLocalName);
		const t = node['c:title'] as XmlObject;
		const run = ((t['c:tx'] as XmlObject)['c:rich'] as XmlObject)['a:p'] as XmlObject;
		expect((run['a:r'] as XmlObject)['a:t']).toBe('Revenue');
	});

	it('updates the text of an existing title, preserving structure', () => {
		const node = axisNode();
		node['c:title'] = titleWith('Old');
		applyChartAxisTitleToXml(node, 'New', getLocalName);
		const t = node['c:title'] as XmlObject;
		const run = ((t['c:tx'] as XmlObject)['c:rich'] as XmlObject)['a:p'] as XmlObject;
		expect((run['a:r'] as XmlObject)['a:t']).toBe('New');
		// overlay child preserved.
		expect(t['c:overlay']).toStrictEqual({ '@_val': '0' });
	});

	it('updates an a:t represented as an object with #text', () => {
		const node = axisNode();
		node['c:title'] = {
			'c:tx': { 'c:rich': { 'a:p': { 'a:r': { 'a:t': { '@_lang': 'en', '#text': 'Old' } } } } },
		};
		applyChartAxisTitleToXml(node, 'New', getLocalName);
		const t = node['c:title'] as XmlObject;
		const at = (((t['c:tx'] as XmlObject)['c:rich'] as XmlObject)['a:p'] as XmlObject)[
			'a:r'
		] as XmlObject;
		expect(at['a:t']).toStrictEqual({ '@_lang': 'en', '#text': 'New' });
	});

	it('removes the title when given an empty string', () => {
		const node = axisNode();
		node['c:title'] = titleWith('Revenue');
		applyChartAxisTitleToXml(node, '', getLocalName);
		expect('c:title' in node).toBeFalsy();
	});

	it('removing an absent title is a no-op', () => {
		const node = axisNode();
		const before = JSON.stringify(node);
		applyChartAxisTitleToXml(node, '', getLocalName);
		expect(JSON.stringify(node)).toBe(before);
	});
});

describe('applyChartAxisTitleStyleToXml', () => {
	function axisWithTitle(): XmlObject {
		return {
			'c:axId': { '@_val': '1' },
			'c:scaling': {},
			'c:title': {
				'c:tx': { 'c:rich': { 'a:p': { 'a:r': { 'a:t': 'Sales' } } } },
				'c:overlay': { '@_val': '0' },
			},
		};
	}

	it('writes font family/size/bold/colour into title txPr defRPr', () => {
		const node = axisWithTitle();
		applyChartAxisTitleStyleToXml(
			node,
			{ fontFamily: 'Calibri', fontSize: 12, fontBold: true, fontColor: '#FF0000' },
			getLocalName,
		);
		const title = node['c:title'] as XmlObject;
		const txPr = title['c:txPr'] as XmlObject;
		const p = txPr['a:p'] as XmlObject;
		const defRPr = (p['a:pPr'] as XmlObject)['a:defRPr'] as XmlObject;
		expect(defRPr['@_sz']).toBe('1200');
		expect(defRPr['@_b']).toBe('1');
		expect((defRPr['a:latin'] as XmlObject)['@_typeface']).toBe('Calibri');
		const fill = defRPr['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('FF0000');
	});

	it('no-ops when no style fields are provided', () => {
		const node = axisWithTitle();
		const before = JSON.stringify(node);
		applyChartAxisTitleStyleToXml(node, {}, getLocalName);
		expect(JSON.stringify(node)).toBe(before);
	});

	it('no-ops when the axis has no title', () => {
		const node: XmlObject = { 'c:axId': { '@_val': '1' }, 'c:scaling': {} };
		applyChartAxisTitleStyleToXml(node, { fontSize: 10 }, getLocalName);
		expect(node['c:title']).toBeUndefined();
	});
});
