import { describe, expect, it } from 'vitest';

import { PptxXmlLookupService } from '../services/PptxXmlLookupService';
import type { XmlObject } from '../types';
import { applyChartUpDownBars, parseChartUpDownBars } from './chart-up-down-bars';
import { buildChartSpaceXml } from './chart-xml-generator';

const lookup = new PptxXmlLookupService();
const localName = (key: string) => key.replace(/^.*:/u, '');
const colorParser = {
	parseColor(node: XmlObject | undefined): string | undefined {
		const srgb = lookup.getChildByLocalName(node, 'srgbClr');
		return srgb?.['@_val'] ? `#${srgb['@_val']}` : undefined;
	},
};

describe('chart up/down bars', () => {
	it('parses gap width and both shape-property branches', () => {
		const container: XmlObject = {
			'c:upDownBars': {
				'c:gapWidth': { '@_val': '175%' },
				'c:upBars': {
					'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '00AA00' } } },
				},
				'c:downBars': {
					'c:spPr': {
						'a:ln': {
							'@_w': '25400',
							'a:solidFill': { 'a:srgbClr': { '@_val': 'CC0000' } },
							'a:prstDash': { '@_val': 'dash' },
						},
					},
				},
			},
		};
		expect(parseChartUpDownBars(container, lookup, colorParser)).toStrictEqual({
			gapWidth: 175,
			upBars: { fillColor: '#00AA00' },
			downBars: { strokeColor: '#CC0000', strokeWidth: 2, strokeDashStyle: 'dash' },
		});
	});

	it('updates formatting while preserving unsupported children', () => {
		const container: XmlObject = {
			'c:ser': [],
			'c:hiLowLines': {},
			'c:upDownBars': {
				'c:upBars': { 'c:spPr': { 'a:effectLst': { marker: true } } },
				'c:extLst': { marker: true },
			},
			'c:marker': {},
			'c:axId': [],
		};
		applyChartUpDownBars(
			container,
			{ gapWidth: 90, upBars: { fillColor: '#ABCDEF', strokeWidth: 1.5 } },
			localName,
		);
		const node = container['c:upDownBars'] as XmlObject;
		const upBars = node['c:upBars'] as XmlObject;
		const spPr = upBars['c:spPr'] as XmlObject;
		expect(spPr['a:effectLst']).toStrictEqual({ marker: true });
		expect(node['c:extLst']).toStrictEqual({ marker: true });
		expect(Object.keys(node)).toStrictEqual(['c:gapWidth', 'c:upBars', 'c:extLst']);
	});

	it('inserts and removes the container in chart schema order', () => {
		const container: XmlObject = {
			'c:ser': [],
			'c:hiLowLines': {},
			'c:marker': {},
			'c:smooth': {},
			'c:axId': [],
		};
		applyChartUpDownBars(container, { downBars: { fillColor: '#FF0000' } }, localName);
		expect(Object.keys(container)).toStrictEqual([
			'c:ser',
			'c:hiLowLines',
			'c:upDownBars',
			'c:marker',
			'c:smooth',
			'c:axId',
		]);
		applyChartUpDownBars(container, null, localName);
		expect(container['c:upDownBars']).toBeUndefined();
	});

	it('validates the CT_GapAmount range', () => {
		expect(() => applyChartUpDownBars({}, { gapWidth: 501 }, localName)).toThrow(
			/between 0 and 500/u,
		);
	});

	it('emits up/down bars for a generated line chart', () => {
		const tree = buildChartSpaceXml({
			chartType: 'line',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
			upDownBars: { gapWidth: 120, upBars: { fillColor: '#00FF00' } },
		});
		const chart = (tree['c:chartSpace'] as XmlObject)['c:chart'] as XmlObject;
		const line = (chart['c:plotArea'] as XmlObject)['c:lineChart'] as XmlObject;
		expect(parseChartUpDownBars(line, lookup, colorParser)).toStrictEqual({
			gapWidth: 120,
			upBars: { fillColor: '#00FF00' },
		});
	});
});
