import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartColorMapOverride } from './chart-color-map-override';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

function chartSpace(): XmlObject {
	return {
		'c:date1904': { '@_val': '0' },
		'c:chart': {},
		'c:externalData': {},
	};
}

describe('applyChartColorMapOverride', () => {
	it('is a no-op when the value is undefined (passthrough)', () => {
		const node = chartSpace();
		applyChartColorMapOverride(node, undefined, getLocalName);
		expect('c:clrMapOvr' in node).toBeFalsy();
	});

	it('inserts c:clrMapOvr before c:chart with the mapped attributes', () => {
		const node = chartSpace();
		applyChartColorMapOverride(node, { bg1: 'lt1', accent1: 'accent2' }, getLocalName);
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('clrMapOvr')).toBeLessThan(keys.indexOf('chart'));
		const clrMapOvr = node['c:clrMapOvr'] as XmlObject;
		expect(clrMapOvr['@_bg1']).toBe('lt1');
		expect(clrMapOvr['@_accent1']).toBe('accent2');
	});

	it('replaces an existing c:clrMapOvr in place', () => {
		const node = chartSpace();
		node['c:clrMapOvr'] = { '@_bg1': 'dk1' };
		applyChartColorMapOverride(node, { bg1: 'lt1' }, getLocalName);
		expect((node['c:clrMapOvr'] as XmlObject)['@_bg1']).toBe('lt1');
	});

	it('removes an existing c:clrMapOvr when the value is null', () => {
		const node = chartSpace();
		node['c:clrMapOvr'] = { '@_bg1': 'dk1' };
		applyChartColorMapOverride(node, null, getLocalName);
		expect('c:clrMapOvr' in node).toBeFalsy();
	});

	it('treats an empty map the same as null (removes the element)', () => {
		const node = chartSpace();
		node['c:clrMapOvr'] = { '@_bg1': 'dk1' };
		applyChartColorMapOverride(node, {}, getLocalName);
		expect('c:clrMapOvr' in node).toBeFalsy();
	});
});
