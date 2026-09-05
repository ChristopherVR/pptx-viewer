import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { parseCxDataLabels } from './chart-cx-data-labels';

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
};

const colorParser = {
	parseColor: (node: XmlObject | undefined): string | undefined => {
		const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
		return srgb?.['@_val'] ? `#${srgb['@_val']}` : undefined;
	},
};

describe('parseCxDataLabels @pos / cx:numFmt (C2-G4)', () => {
	it('returns undefined when the series has no cx:dataLabels', () => {
		expect(parseCxDataLabels({}, xmlLookup)).toBeUndefined();
	});

	it('reads the group-level @pos and cx:numFmt', () => {
		const ser: XmlObject = {
			'cx:dataLabels': { '@_pos': 'outEnd', 'cx:numFmt': { '@_formatCode': '$#,##0' } },
		};
		const result = parseCxDataLabels(ser, xmlLookup);
		expect(result?.options).toStrictEqual({ position: 'outEnd', numberFormat: '$#,##0' });
	});
});

describe('parseCxDataLabels cx:txPr font (C2 wave-1 skip)', () => {
	const txPr: XmlObject = {
		'a:p': {
			'a:pPr': {
				'a:defRPr': {
					'@_sz': '1200',
					'@_b': '1',
					'a:latin': { '@_typeface': 'Calibri' },
					'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
				},
			},
		},
	};

	it('parses cx:dataLabels/cx:txPr onto the group-level options.txPr', () => {
		const ser: XmlObject = { 'cx:dataLabels': { '@_pos': 'ctr', 'cx:txPr': txPr } };
		const result = parseCxDataLabels(ser, xmlLookup, colorParser);
		expect(result?.options?.txPr).toStrictEqual({
			fontSize: 12,
			bold: true,
			fontFamily: 'Calibri',
			color: '#FF0000',
		});
	});

	it('resolves a theme-font placeholder on cx:dataLabels/cx:txPr when resolveTypeface is given', () => {
		const ser: XmlObject = {
			'cx:dataLabels': {
				'cx:txPr': {
					'a:p': { 'a:pPr': { 'a:defRPr': { 'a:latin': { '@_typeface': '+mn-lt' } } } },
				},
			},
		};
		const result = parseCxDataLabels(ser, xmlLookup, colorParser, () => 'Bahnschrift');
		expect(result?.options?.txPr).toStrictEqual({ fontFamily: 'Bahnschrift' });
	});

	it("parses a per-point cx:dataLabel/cx:txPr onto that label's own txPr", () => {
		const ser: XmlObject = {
			'cx:dataLabels': {
				'cx:dataLabel': { '@_idx': '2', 'cx:txPr': txPr },
			},
		};
		const result = parseCxDataLabels(ser, xmlLookup, colorParser);
		expect(result?.labels[0]).toMatchObject({
			idx: 2,
			txPr: { fontSize: 12, bold: true, fontFamily: 'Calibri', color: '#FF0000' },
		});
	});

	it('does not populate txPr when no colorParser is given', () => {
		const ser: XmlObject = { 'cx:dataLabels': { 'cx:txPr': txPr } };
		const result = parseCxDataLabels(ser, xmlLookup);
		expect(result?.options?.txPr).toBeUndefined();
	});
});
