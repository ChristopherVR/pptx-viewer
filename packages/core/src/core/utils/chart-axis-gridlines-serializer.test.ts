import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartAxisGridlinesToXml } from './chart-axis-gridlines-serializer';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

function axisNode(): XmlObject {
	return {
		'c:axId': { '@_val': '1' },
		'c:scaling': {},
		'c:axPos': { '@_val': 'l' },
		'c:numFmt': { '@_formatCode': 'General' },
	};
}

describe('applyChartAxisGridlinesToXml', () => {
	it('is a no-op when both flags are undefined', () => {
		const node = axisNode();
		const before = JSON.stringify(node);
		applyChartAxisGridlinesToXml(node, {}, getLocalName);
		expect(JSON.stringify(node)).toBe(before);
	});

	it('inserts major gridlines after axPos and before numFmt', () => {
		const node = axisNode();
		applyChartAxisGridlinesToXml(node, { majorGridlines: true }, getLocalName);
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('majorGridlines')).toBeGreaterThan(keys.indexOf('axPos'));
		expect(keys.indexOf('majorGridlines')).toBeLessThan(keys.indexOf('numFmt'));
	});

	it('orders major before minor gridlines', () => {
		const node = axisNode();
		applyChartAxisGridlinesToXml(
			node,
			{ majorGridlines: true, minorGridlines: true },
			getLocalName,
		);
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('majorGridlines')).toBeLessThan(keys.indexOf('minorGridlines'));
		expect(keys.indexOf('minorGridlines')).toBeLessThan(keys.indexOf('numFmt'));
	});

	it('removes gridlines when toggled off', () => {
		const node = axisNode();
		node['c:majorGridlines'] = {};
		applyChartAxisGridlinesToXml(node, { majorGridlines: false }, getLocalName);
		expect('c:majorGridlines' in node).toBeFalsy();
	});

	it('preserves an existing major gridlines element (with styling) when toggled on', () => {
		const node = axisNode();
		node['c:majorGridlines'] = { 'c:spPr': { 'a:ln': { '@_w': '9525' } } };
		applyChartAxisGridlinesToXml(node, { majorGridlines: true }, getLocalName);
		expect(node['c:majorGridlines']).toStrictEqual({ 'c:spPr': { 'a:ln': { '@_w': '9525' } } });
	});

	it('turning on an already-absent minor gridline is idempotent on re-run', () => {
		const node = axisNode();
		applyChartAxisGridlinesToXml(node, { minorGridlines: true }, getLocalName);
		applyChartAxisGridlinesToXml(node, { minorGridlines: true }, getLocalName);
		const minorCount = Object.keys(node).filter((k) => getLocalName(k) === 'minorGridlines').length;
		expect(minorCount).toBe(1);
	});
});

describe('applyChartAxisGridlinesToXml styling', () => {
	function axisNode2(): XmlObject {
		return { 'c:axId': { '@_val': '1' }, 'c:scaling': {}, 'c:axPos': { '@_val': 'l' } };
	}

	it('applies stroke colour/width/dash onto an existing major gridline spPr', () => {
		const node = axisNode2();
		applyChartAxisGridlinesToXml(
			node,
			{
				majorGridlines: true,
				majorGridlinesSpPr: { strokeColor: '#CCCCCC', strokeWidth: 0.75, strokeDashStyle: 'dash' },
			},
			getLocalName,
		);
		const grid = node['c:majorGridlines'] as XmlObject;
		const ln = (grid['c:spPr'] as XmlObject)['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe(String(Math.round(0.75 * 12700)));
		const fill = ln['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('CCCCCC');
		expect((ln['a:prstDash'] as XmlObject)['@_val']).toBe('dash');
	});

	it('does not apply style when the gridline element is absent', () => {
		const node = axisNode2();
		applyChartAxisGridlinesToXml(
			node,
			{ minorGridlinesSpPr: { strokeColor: '#EEEEEE' } },
			getLocalName,
		);
		expect(node['c:minorGridlines']).toBeUndefined();
	});
});
