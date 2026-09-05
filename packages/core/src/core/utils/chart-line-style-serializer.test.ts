import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartLineStyle } from './chart-line-style-serializer';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

function lineChartContainer(): XmlObject {
	return {
		'c:grouping': { '@_val': 'standard' },
		'c:ser': {},
		'c:marker': { '@_val': '1' },
		'c:axId': [{ '@_val': '1' }, { '@_val': '2' }],
	};
}

describe('applyChartLineStyle', () => {
	it('is a no-op when the style is undefined (passthrough)', () => {
		const node = lineChartContainer();
		applyChartLineStyle(node, 'dropLines', undefined, getLocalName);
		expect('c:dropLines' in node).toBeFalsy();
	});

	it('inserts c:dropLines in schema order (after ser/dLbls, before hiLowLines/marker)', () => {
		const node = lineChartContainer();
		applyChartLineStyle(
			node,
			'dropLines',
			{ color: '#FF0000', width: 1, dashStyle: 'dash' },
			getLocalName,
		);
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('ser')).toBeLessThan(keys.indexOf('dropLines'));
		expect(keys.indexOf('dropLines')).toBeLessThan(keys.indexOf('marker'));
		const dropLines = node['c:dropLines'] as XmlObject;
		const ln = (dropLines['c:spPr'] as XmlObject)['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe(String(Math.round(1 * 12700)));
		expect((ln['a:prstDash'] as XmlObject)['@_val']).toBe('dash');
		expect(((ln['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('FF0000');
	});

	it('inserts a bare c:hiLowLines (no spPr) when the style has no line props', () => {
		const node = lineChartContainer();
		applyChartLineStyle(node, 'hiLowLines', {}, getLocalName);
		expect(node['c:hiLowLines']).toStrictEqual({});
	});

	it('updates an existing c:dropLines in place, preserving unmodeled children', () => {
		const node = lineChartContainer();
		node['c:dropLines'] = { 'c:extLst': { keep: true } };
		applyChartLineStyle(node, 'dropLines', { color: '#00FF00' }, getLocalName);
		const dropLines = node['c:dropLines'] as XmlObject;
		expect(dropLines['c:extLst']).toStrictEqual({ keep: true });
		const fill = (dropLines['c:spPr'] as XmlObject)['a:ln'] as XmlObject;
		expect(((fill['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('00FF00');
	});

	it('removes an existing c:hiLowLines when the style is explicitly null', () => {
		const node = lineChartContainer();
		node['c:hiLowLines'] = { 'c:spPr': {} };
		applyChartLineStyle(node, 'hiLowLines', null, getLocalName);
		expect('c:hiLowLines' in node).toBeFalsy();
	});
});
