import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { parseCxValueColors } from './chart-cx-value-colors';

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
	getScalarChildByLocalName: () => undefined,
};

const colorParser = {
	parseColor: (node: XmlObject | undefined): string | undefined => {
		const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
		return srgb ? `#${srgb['@_val']}` : undefined;
	},
};

describe('parseCxValueColors (C2-G6)', () => {
	it('returns undefined when neither valueColors nor valueColorPositions is present', () => {
		expect(parseCxValueColors({ '@_layoutId': 'regionMap' }, xmlLookup)).toBeUndefined();
	});

	it('resolves each cx:valueColors child colour, in order, when a colorParser is given', () => {
		const series: XmlObject = {
			'cx:valueColors': {
				'cx:minColor': { 'a:srgbClr': { '@_val': 'AA0000' } },
				'cx:maxColor': { 'a:srgbClr': { '@_val': '00AA00' } },
			},
		};
		expect(parseCxValueColors(series, xmlLookup, colorParser)?.valueColors).toStrictEqual([
			'#AA0000',
			'#00AA00',
		]);
	});

	it('does not resolve colours without a colorParser', () => {
		const series: XmlObject = {
			'cx:valueColors': { 'cx:minColor': { 'a:srgbClr': { '@_val': 'AA0000' } } },
		};
		expect(parseCxValueColors(series, xmlLookup)?.valueColors).toBeUndefined();
	});

	it('parses cx:valueColorPositions/cx:pos into typed min/max/number/percent breakpoints', () => {
		const series: XmlObject = {
			'cx:valueColorPositions': {
				'cx:pos': [
					{ '@_type': 'min' },
					{ '@_type': 'num', '@_val': '50' },
					{ '@_type': 'percent', '@_val': '90' },
					{ '@_type': 'max' },
				],
			},
		};
		expect(parseCxValueColors(series, xmlLookup)?.valueColorPositions).toStrictEqual([
			{ kind: 'min' },
			{ kind: 'number', value: 50 },
			{ kind: 'percent', value: 90 },
			{ kind: 'max' },
		]);
	});

	it('ignores a cx:pos with an unrecognised @type', () => {
		const series: XmlObject = {
			'cx:valueColorPositions': { 'cx:pos': { '@_type': 'formula', '@_val': '1' } },
		};
		expect(parseCxValueColors(series, xmlLookup)).toBeUndefined();
	});
});
