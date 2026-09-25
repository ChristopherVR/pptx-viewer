import { describe, expect, it } from 'vitest';

import { PptxXmlLookupService } from '../services/PptxXmlLookupService';
import type { PptxChartDataLabelOptions, XmlObject } from '../types';
import { parseDataLabelBox } from './chart-data-label-box';

const lookup = new PptxXmlLookupService();
const colorParser = {
	parseColor: (node: XmlObject | undefined) =>
		node?.['a:srgbClr'] ? `#${String((node['a:srgbClr'] as XmlObject)['@_val'])}` : undefined,
};

describe('parseDataLabelBox (COM: charts-com.pptx slide 17)', () => {
	it('reads the label fill, the c15 callout shape and the c15 leader-line flag', () => {
		const group: XmlObject = {
			'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'FFFFCC' } } },
			'c:extLst': {
				'c:ext': {
					'@_uri': '{CE6537A1-D6FC-4f65-9D91-7224C49458BB}',
					'c15:spPr': { 'a:prstGeom': { '@_prst': 'wedgeRectCallout' } },
					'c15:showLeaderLines': { '@_val': '1' },
				},
			},
		};
		const result: PptxChartDataLabelOptions = {};
		parseDataLabelBox(group, lookup, colorParser, result);
		expect(result).toStrictEqual({
			labelShape: { fillColor: '#FFFFCC' },
			calloutShape: 'wedgeRectCallout',
			extLeaderLines: true,
		});
	});

	it('leaves a plain label untouched', () => {
		const result: PptxChartDataLabelOptions = {};
		parseDataLabelBox({}, lookup, colorParser, result);
		expect(result).toStrictEqual({});
	});
});
