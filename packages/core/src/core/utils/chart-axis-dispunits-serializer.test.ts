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

	it('inserts dispUnits before extLst', () => {
		const node = axisNode();
		node['c:extLst'] = {};
		applyChartAxisDisplayUnitsToXml(node, { displayUnits: 'billions' }, getLocalName);
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('dispUnits')).toBeLessThan(keys.indexOf('extLst'));
	});
});
