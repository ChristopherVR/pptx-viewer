import { describe, expect, it } from 'vitest';

import { PptxXmlLookupService } from '../services/PptxXmlLookupService';
import type { XmlObject } from '../types';
import { parseChartDataLabelOptions, parseSeriesDataLabels } from './chart-data-label-parser';

const lookup = new PptxXmlLookupService();

describe('chartML data label parsing', () => {
	it('parses common CT_DLbl fields and XML boolean lexical forms', () => {
		const series: XmlObject = {
			'c:dLbls': {
				'c:dLbl': {
					'c:idx': { '@_val': '4' },
					'c:delete': { '@_val': 'false' },
					'c:dLblPos': { '@_val': 'bestFit' },
					'c:showVal': { '@_val': 'true' },
					'c:showLeaderLines': { '@_val': '0' },
					'c:separator': '; ',
				},
			},
		};
		expect(parseSeriesDataLabels(series, lookup)).toStrictEqual([
			{
				idx: 4,
				deleted: false,
				position: 'bestFit',
				showVal: true,
				showLeaderLines: false,
				separator: '; ',
			},
		]);
	});

	it('rejects invalid unsigned indexes and label-position enum values', () => {
		const group: XmlObject = {
			'c:dLbl': [
				{ 'c:idx': { '@_val': '-1' }, 'c:showVal': { '@_val': '1' } },
				{ 'c:idx': { '@_val': '1' }, 'c:dLblPos': { '@_val': 'sideways' } },
			],
		};
		const parsed = parseSeriesDataLabels({ 'c:dLbls': group }, lookup);
		expect(parsed).toStrictEqual([{ idx: 1 }]);
	});

	it('parses common CT_DLbls options', () => {
		const group: XmlObject = {
			'c:dLblPos': { '@_val': 'outEnd' },
			'c:showVal': { '@_val': '1' },
			'c:showBubbleSize': { '@_val': 'true' },
			'c:separator': '\n',
			'c:showLeaderLines': { '@_val': 'false' },
		};
		expect(parseChartDataLabelOptions(group, lookup)).toStrictEqual({
			position: 'outEnd',
			showValue: true,
			showBubbleSize: true,
			separator: '\n',
			showLeaderLines: false,
		});
	});
});
