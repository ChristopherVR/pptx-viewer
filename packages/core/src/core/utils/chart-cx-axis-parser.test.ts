import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { parseCxAxes, resolveCxTitleText } from './chart-cx-axis-parser';

/** Minimal XmlLookupLike stub using plain object traversal (mirrors chart-cx-parser.test.ts). */
const xmlLookup = {
	getChildByLocalName(parent: XmlObject | undefined, localName: string): XmlObject | undefined {
		if (!parent) {
			return undefined;
		}
		for (const key of Object.keys(parent)) {
			const local = key.split(':').at(-1);
			if (local === localName && typeof parent[key] === 'object') {
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
			const local = key.split(':').at(-1);
			if (local === localName) {
				const val = parent[key];
				if (Array.isArray(val)) {
					return val as XmlObject[];
				}
				if (typeof val === 'object' && val !== null) {
					return [val as XmlObject];
				}
			}
		}
		return [];
	},
	getScalarChildByLocalName(
		parent: XmlObject | undefined,
		localName: string,
	): string | number | boolean | undefined {
		if (!parent) {
			return undefined;
		}
		for (const key of Object.keys(parent)) {
			const local = key.split(':').at(-1);
			if (local === localName) {
				const val = parent[key];
				if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
					return val;
				}
			}
		}
		return undefined;
	},
};

describe('parseCxAxes (C2-G7)', () => {
	it('returns undefined when the plotArea has no cx:axis siblings', () => {
		expect(parseCxAxes({ 'cx:plotAreaRegion': {} }, xmlLookup)).toBeUndefined();
	});

	it('parses title, numFmt, gridlines, and tick-label visibility on a cx:axis', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {},
			'cx:axis': {
				'@_id': '1',
				'cx:catScaling': {},
				'cx:title': { 'cx:tx': { 'cx:rich': { 'a:p': { 'a:r': { 'a:t': 'Quarter' } } } } },
				'cx:numFmt': { '@_formatCode': '0%', '@_sourceLinked': '0' },
				'cx:majorGridlines': {},
				// no cx:tickLabels -> hidden tick labels
			},
		};
		const [axis] = parseCxAxes(plotArea, xmlLookup)!;
		expect(axis.axisType).toBe('catAx');
		expect(axis.axisId).toBe(1);
		expect(axis.titleText).toBe('Quarter');
		expect(axis.numFmt).toStrictEqual({ formatCode: '0%', sourceLinked: false });
		expect(axis.majorGridlines).toBeTruthy();
		expect(axis.tickLblPos).toBe('none');
	});

	it('parses multiple cx:axis siblings and defaults to valAx without cx:catScaling', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {},
			'cx:axis': [
				{ '@_id': '0', 'cx:catScaling': {} },
				{ '@_id': '1', 'cx:valScaling': {}, 'cx:tickLabels': {} },
			],
		};
		const axes = parseCxAxes(plotArea, xmlLookup)!;
		expect(axes).toHaveLength(2);
		expect(axes[0].axisType).toBe('catAx');
		expect(axes[1].axisType).toBe('valAx');
		// cx:tickLabels present -> labels are shown, no forced 'none'.
		expect(axes[1].tickLblPos).toBeUndefined();
	});

	it('marks an axis hidden via @hidden and resolves fontFamily/fontColor from cx:txPr', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {},
			'cx:axis': {
				'@_id': '2',
				'@_hidden': '1',
				'cx:valScaling': {},
				'cx:txPr': {
					'a:p': {
						'a:pPr': {
							'a:defRPr': {
								'@_sz': '900',
								'@_b': '1',
								'a:latin': { '@_typeface': 'Calibri' },
								'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
							},
						},
					},
				},
			},
		};
		const colorParser = {
			parseColor: (node: XmlObject | undefined) => {
				const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
				return srgb ? `#${srgb['@_val']}` : undefined;
			},
		};
		const [axis] = parseCxAxes(plotArea, xmlLookup, colorParser)!;
		expect(axis.deleted).toBeTruthy();
		expect(axis.fontFamily).toBe('Calibri');
		expect(axis.fontSize).toBe(9);
		expect(axis.fontBold).toBeTruthy();
		expect(axis.fontColor).toBe('#FF0000');
	});

	it('parses cx:units/@unit onto the same custom-divisor bucket classic c:dispUnits uses (C1)', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {},
			'cx:axis': {
				'@_id': '3',
				'cx:valScaling': {},
				'cx:units': { '@_unit': '1000' },
			},
		};
		const [axis] = parseCxAxes(plotArea, xmlLookup)!;
		expect(axis.displayUnits).toBe('custom');
		expect(axis.displayUnitsValue).toBe(1000);
		expect(axis.displayUnitsLabel).toBeUndefined();
	});

	it('parses cx:unitsLabel text and cx:txPr font onto displayUnitsLabel (C1)', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {},
			'cx:axis': {
				'@_id': '4',
				'cx:valScaling': {},
				'cx:units': {
					'@_unit': '1000000',
					'cx:unitsLabel': {
						'cx:tx': { 'cx:rich': { 'a:p': { 'a:r': { 'a:t': 'Millions' } } } },
						'cx:txPr': {
							'a:p': { 'a:pPr': { 'a:defRPr': { '@_sz': '800', '@_b': '1' } } },
						},
					},
				},
			},
		};
		const [axis] = parseCxAxes(plotArea, xmlLookup)!;
		expect(axis.displayUnits).toBe('custom');
		expect(axis.displayUnitsValue).toBe(1000000);
		expect(axis.displayUnitsLabel).toStrictEqual({
			text: 'Millions',
			fontSize: 8,
			fontBold: true,
		});
	});

	it('ignores cx:units with a non-positive or missing @unit', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {},
			'cx:axis': { '@_id': '5', 'cx:valScaling': {}, 'cx:units': { '@_unit': '0' } },
		};
		const [axis] = parseCxAxes(plotArea, xmlLookup)!;
		expect(axis.displayUnits).toBeUndefined();
	});
});

describe('resolveCxTitleText', () => {
	it('returns undefined for a missing title node', () => {
		expect(resolveCxTitleText(undefined, xmlLookup)).toBeUndefined();
	});

	it('reads rich a:t run text when present', () => {
		const title: XmlObject = { 'cx:tx': { 'cx:rich': { 'a:p': { 'a:r': { 'a:t': 'Revenue' } } } } };
		expect(resolveCxTitleText(title, xmlLookup)).toBe('Revenue');
	});

	it('falls back to the linked-cell cached text (cx:tx/cx:txData/cx:v) with no rich text', () => {
		const title: XmlObject = { 'cx:tx': { 'cx:txData': { 'cx:v': 'Sheet1!$A$1 cache' } } };
		expect(resolveCxTitleText(title, xmlLookup)).toBe('Sheet1!$A$1 cache');
	});
});
