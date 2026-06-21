import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import {
	applyChartAxisTitleToXml,
	applyChartAxisTitleStyleToXml,
} from './chart-axis-title-serializer';

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
