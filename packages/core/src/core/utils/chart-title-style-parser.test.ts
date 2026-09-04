import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { parseChartTitleStyle } from './chart-title-style-parser';

const xmlLookup = {
	getChildByLocalName: (parent: XmlObject | undefined, name: string): XmlObject | undefined => {
		if (!parent) {
			return undefined;
		}
		const key = Object.keys(parent).find((k) => k.replace(/^[^:]+:/u, '') === name);
		const value = key ? parent[key] : undefined;
		return value && typeof value === 'object' ? (value as XmlObject) : undefined;
	},
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string): XmlObject[] => {
		const one = xmlLookup.getChildByLocalName(parent, name);
		return one ? [one] : [];
	},
};

const colorParser = {
	parseColor: (fill: XmlObject | undefined): string | undefined => {
		const srgb = fill?.['a:srgbClr'] as XmlObject | undefined;
		return srgb ? `#${String(srgb['@_val'])}` : undefined;
	},
};

describe('parseChartTitleStyle', () => {
	it('reads c:title/c:tx/c:rich a:defRPr font, size, bold, colour and c:spPr', () => {
		const title: XmlObject = {
			'c:tx': {
				'c:rich': {
					'a:p': {
						'a:pPr': {
							'a:defRPr': {
								'@_sz': '1800',
								'@_b': '1',
								'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
								'a:latin': { '@_typeface': '+mn-lt' },
							},
						},
						'a:r': { 'a:t': 'Revenue' },
					},
				},
			},
			'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '334455' } } },
		};
		expect(
			parseChartTitleStyle(title, xmlLookup, colorParser, (raw) =>
				raw === '+mn-lt' ? 'Calibri' : raw,
			),
		).toStrictEqual({
			titleSpPr: { fillColor: '#334455' },
			titleFontFamily: 'Calibri',
			titleFontSize: 18,
			titleFontBold: true,
			titleFontColor: '#FF0000',
		});
	});

	it('falls back to c:title/c:txPr for an automatic title without a rich body', () => {
		const title: XmlObject = {
			'c:txPr': { 'a:p': { 'a:pPr': { 'a:defRPr': { '@_sz': '1400' } } } },
		};
		expect(parseChartTitleStyle(title, xmlLookup, colorParser)).toStrictEqual({
			titleFontSize: 14,
		});
	});

	it('returns no fields for an unstyled title', () => {
		expect(
			parseChartTitleStyle({ 'c:overlay': { '@_val': '0' } }, xmlLookup, colorParser),
		).toStrictEqual({});
	});
});
