import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartAxisDisplayUnitsToXml } from './chart-axis-dispunits-serializer';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

function axisNode(): XmlObject {
	return {
		'c:axId': { '@_val': '1' },
		'c:scaling': {},
		'c:majorUnit': { '@_val': '10' },
	};
}

describe('applyChartAxisDisplayUnitsToXml', () => {
	it('does nothing when there are no units and no existing node', () => {
		const node = axisNode();
		const before = JSON.stringify(node);
		applyChartAxisDisplayUnitsToXml(node, {}, getLocalName);
		expect(JSON.stringify(node)).toBe(before);
	});

	it('writes a built-in unit', () => {
		const node = axisNode();
		applyChartAxisDisplayUnitsToXml(node, { displayUnits: 'thousands' }, getLocalName);
		expect((node['c:dispUnits'] as XmlObject)['c:builtInUnit']).toStrictEqual({
			'@_val': 'thousands',
		});
	});

	it('writes a custom unit divisor', () => {
		const node = axisNode();
		applyChartAxisDisplayUnitsToXml(
			node,
			{ displayUnits: 'custom', displayUnitsValue: 2500 },
			getLocalName,
		);
		expect((node['c:dispUnits'] as XmlObject)['c:custUnit']).toStrictEqual({ '@_val': '2500' });
	});

	it('removes display units when cleared', () => {
		const node = axisNode();
		node['c:dispUnits'] = { 'c:builtInUnit': { '@_val': 'millions' } };
		applyChartAxisDisplayUnitsToXml(node, {}, getLocalName);
		expect('c:dispUnits' in node).toBeFalsy();
	});

	it('preserves an existing dispUnitsLbl when changing the unit', () => {
		const node = axisNode();
		node['c:dispUnits'] = {
			'c:builtInUnit': { '@_val': 'thousands' },
			'c:dispUnitsLbl': { 'c:layout': {} },
		};
		applyChartAxisDisplayUnitsToXml(node, { displayUnits: 'millions' }, getLocalName);
		const du = node['c:dispUnits'] as XmlObject;
		expect(du['c:builtInUnit']).toStrictEqual({ '@_val': 'millions' });
		expect(du['c:dispUnitsLbl']).toStrictEqual({ 'c:layout': {} });
	});

	it('edits label text, layout, and shape properties in schema order', () => {
		const node = axisNode();
		applyChartAxisDisplayUnitsToXml(
			node,
			{
				displayUnits: 'millions',
				displayUnitsLabel: {
					text: 'M',
					layout: { x: 0.2, y: 0.1 },
					spPr: { fillColor: '#AABBCC', strokeWidth: 2 },
				},
			},
			getLocalName,
		);
		const units = node['c:dispUnits'] as XmlObject;
		const label = units['c:dispUnitsLbl'] as XmlObject;
		expect(
			(((label['c:tx'] as XmlObject)['c:rich'] as XmlObject)['a:p'] as XmlObject)['a:r'],
		).toStrictEqual({
			'a:t': 'M',
		});
		expect(
			(((label['c:layout'] as XmlObject)['c:manualLayout'] as XmlObject)['c:x'] as XmlObject)[
				'@_val'
			],
		).toBe('0.2');
		expect(((label['c:spPr'] as XmlObject)['a:solidFill'] as XmlObject)['a:srgbClr']).toStrictEqual(
			{ '@_val': 'AABBCC' },
		);
		expect(Object.keys(label).map(getLocalName)).toStrictEqual(['layout', 'tx', 'spPr']);
	});

	it('retains extension and unmodeled XML during a dirty write', () => {
		const node = axisNode();
		node['c:dispUnits'] = {
			'c:builtInUnit': { '@_val': 'thousands' },
			'c:dispUnitsLbl': { 'c:layout': {}, 'c:txPr': { 'a:bodyPr': { '@_rot': '0' } } },
			'c:extLst': { 'c:ext': { '@_uri': 'vendor' } },
		};
		applyChartAxisDisplayUnitsToXml(
			node,
			{ displayUnits: 'custom', displayUnitsValue: 2500, displayUnitsLabel: { text: 'K' } },
			getLocalName,
		);
		const units = node['c:dispUnits'] as XmlObject;
		expect(units['c:builtInUnit']).toBeUndefined();
		expect(units['c:extLst']).toStrictEqual({ 'c:ext': { '@_uri': 'vendor' } });
		expect((units['c:dispUnitsLbl'] as XmlObject)['c:txPr']).toStrictEqual({
			'a:bodyPr': { '@_rot': '0' },
		});
		expect(Object.keys(units).map(getLocalName)).toStrictEqual([
			'custUnit',
			'dispUnitsLbl',
			'extLst',
		]);
	});

	it('validates custom and built-in unit values', () => {
		expect(() =>
			applyChartAxisDisplayUnitsToXml(
				axisNode(),
				{ displayUnits: 'custom', displayUnitsValue: 0 },
				getLocalName,
			),
		).toThrow(RangeError);
		expect(() =>
			applyChartAxisDisplayUnitsToXml(
				axisNode(),
				{ displayUnits: 'invalid' as 'millions' },
				getLocalName,
			),
		).toThrow(/Unsupported built-in/u);
	});

	it('removes an explicitly cleared display-unit label', () => {
		const node = axisNode();
		node['c:dispUnits'] = {
			'c:builtInUnit': { '@_val': 'millions' },
			'c:dispUnitsLbl': { 'c:layout': {} },
		};
		applyChartAxisDisplayUnitsToXml(
			node,
			{ displayUnits: 'millions', displayUnitsLabel: null },
			getLocalName,
		);
		expect((node['c:dispUnits'] as XmlObject)['c:dispUnitsLbl']).toBeUndefined();
	});

	it('inserts dispUnits before extLst', () => {
		const node = axisNode();
		node['c:extLst'] = {};
		applyChartAxisDisplayUnitsToXml(node, { displayUnits: 'billions' }, getLocalName);
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('dispUnits')).toBeLessThan(keys.indexOf('extLst'));
	});
});
