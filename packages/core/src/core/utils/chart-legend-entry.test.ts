import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartLegendToXml, parseChartLegendEntries } from './chart-legend-serializer';

const localName = (key: string) => key.replace(/^.*:/u, '');
const parseColor = (node: XmlObject | undefined) => {
	const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
	return srgb?.['@_val'] ? `#${srgb['@_val']}` : undefined;
};

describe('chart legend entries', () => {
	it('parses delete values and the CT_Boolean default', () => {
		const legend: XmlObject = {
			'c:legendEntry': [
				{ 'c:idx': { '@_val': '0' }, 'c:delete': {} },
				{ 'c:idx': { '@_val': '2' }, 'c:delete': { '@_val': '0' } },
			],
		};
		expect(parseChartLegendEntries(legend, localName, parseColor)).toStrictEqual([
			{ index: 0, deleted: true },
			{ index: 2, deleted: false },
		]);
	});

	it('parses common DrawingML text defaults', () => {
		const legend: XmlObject = {
			'c:legendEntry': {
				'c:idx': { '@_val': '1' },
				'c:txPr': {
					'a:p': {
						'a:pPr': {
							'a:defRPr': {
								'@_sz': '1200',
								'@_b': '1',
								'@_i': '0',
								'a:latin': { '@_typeface': 'Aptos' },
								'a:solidFill': { 'a:srgbClr': { '@_val': '112233' } },
							},
						},
					},
				},
			},
		};
		expect(parseChartLegendEntries(legend, localName, parseColor)).toStrictEqual([
			{
				index: 1,
				textStyle: {
					fontSize: 12,
					bold: true,
					italic: false,
					fontFamily: 'Aptos',
					color: '#112233',
				},
			},
		]);
	});

	it('edits an entry while preserving its extension list', () => {
		const root: XmlObject = {
			'c:plotArea': {},
			'c:legend': {
				'c:legendEntry': {
					'c:idx': { '@_val': '3' },
					'c:delete': {},
					'c:extLst': { marker: true },
				},
			},
		};
		applyChartLegendToXml(
			root,
			{ legendEntries: [{ index: 3, textStyle: { fontSize: 10, bold: false } }] },
			localName,
		);
		const legend = root['c:legend'] as XmlObject;
		const entry = (legend['c:legendEntry'] as XmlObject[])[0];
		expect(Object.keys(entry)).toStrictEqual(['c:idx', 'c:txPr', 'c:extLst']);
		expect(entry['c:extLst']).toStrictEqual({ marker: true });
		expect(parseChartLegendEntries(legend, localName, parseColor)).toStrictEqual([
			{ index: 3, textStyle: { fontSize: 10, bold: false } },
		]);
	});

	it('adds a hidden entry to a newly created legend', () => {
		const root: XmlObject = { 'c:plotArea': {}, 'c:plotVisOnly': {} };
		applyChartLegendToXml(
			root,
			{ hasLegend: true, legendEntries: [{ index: 4, deleted: true }] },
			localName,
		);
		const legend = root['c:legend'] as XmlObject;
		expect(parseChartLegendEntries(legend, localName, parseColor)).toContainEqual({
			index: 4,
			deleted: true,
		});
	});
});
