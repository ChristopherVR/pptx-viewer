import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { parseCxRegionMapOptions } from './chart-cx-region-map';

const xmlLookup = {
	getChildByLocalName(parent: XmlObject | undefined, localName: string): XmlObject | undefined {
		if (!parent) {
			return undefined;
		}
		for (const key of Object.keys(parent)) {
			if (key.split(':').at(-1) === localName && typeof parent[key] === 'object') {
				return parent[key] as XmlObject;
			}
		}
		return undefined;
	},
	getChildrenArrayByLocalName(parent: XmlObject | undefined, localName: string): XmlObject[] {
		if (!parent) {
			return [];
		}
		for (const key of Object.keys(parent)) {
			if (key.split(':').at(-1) === localName) {
				const val = parent[key];
				return Array.isArray(val) ? (val as XmlObject[]) : [val as XmlObject];
			}
		}
		return [];
	},
	getScalarChildByLocalName(parent: XmlObject | undefined, localName: string): unknown {
		if (!parent) {
			return undefined;
		}
		for (const key of Object.keys(parent)) {
			if (key.split(':').at(-1) === localName) {
				const val = parent[key];
				return typeof val === 'object' ? (val as XmlObject)['#text'] : val;
			}
		}
		return undefined;
	},
};

const colorParser = {
	parseColor: (node: XmlObject | undefined): string | undefined => {
		const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
		return srgb ? `#${srgb['@_val']}` : undefined;
	},
};

describe('parseCxRegionMapOptions value-colors wiring (C2-G6)', () => {
	it('is undefined for a non-regionMap series', () => {
		expect(
			parseCxRegionMapOptions({ '@_layoutId': 'treemap' }, undefined, xmlLookup),
		).toBeUndefined();
	});

	it('attaches valueColors and valueColorPositions to a region-map series', () => {
		const series: XmlObject = {
			'@_layoutId': 'regionMap',
			'cx:valueColors': { 'cx:minColor': { 'a:srgbClr': { '@_val': '0000FF' } } },
			'cx:valueColorPositions': { 'cx:pos': { '@_type': 'min' } },
		};
		const options = parseCxRegionMapOptions(series, undefined, xmlLookup, colorParser);
		expect(options?.valueColors).toStrictEqual(['#0000FF']);
		expect(options?.valueColorPositions).toStrictEqual([{ kind: 'min' }]);
	});
});
