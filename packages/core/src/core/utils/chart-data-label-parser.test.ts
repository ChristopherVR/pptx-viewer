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

	// C2-G16: c:dLbls/c:numFmt and c:dLbl/c:numFmt (label-specific number format,
	// distinct from the series' own cell format).
	it('parses c:dLbls/c:numFmt into the group-level numberFormat (C2-G16)', () => {
		const group: XmlObject = {
			'c:numFmt': { '@_formatCode': '$#,##0,,"M"', '@_sourceLinked': '0' },
			'c:showVal': { '@_val': '1' },
		};
		expect(parseChartDataLabelOptions(group, lookup).numberFormat).toBe('$#,##0,,"M"');
	});

	it('parses c:dLbl/c:numFmt into the per-point numberFormat (C2-G16)', () => {
		const series: XmlObject = {
			'c:dLbls': {
				'c:dLbl': {
					'c:idx': { '@_val': '0' },
					'c:numFmt': { '@_formatCode': '0%', '@_sourceLinked': '0' },
					'c:showVal': { '@_val': '1' },
				},
			},
		};
		const [label] = parseSeriesDataLabels(series, lookup);
		expect(label.numberFormat).toBe('0%');
	});

	// C2-G15: c:dLbl/c:layout/c:manualLayout (a data label dragged off its
	// automatic position), using the same parseChartManualLayout helper as
	// title/legend/plotArea.
	it('parses c:dLbl/c:layout/c:manualLayout into the per-point layout (C2-G15)', () => {
		const series: XmlObject = {
			'c:dLbls': {
				'c:dLbl': {
					'c:idx': { '@_val': '2' },
					'c:layout': {
						'c:manualLayout': {
							'c:x': { '@_val': '0.05' },
							'c:y': { '@_val': '-0.1' },
						},
					},
					'c:showVal': { '@_val': '1' },
				},
			},
		};
		const [label] = parseSeriesDataLabels(series, lookup);
		expect(label.layout).toStrictEqual({ x: 0.05, y: -0.1 });
	});

	// C2-G13: PowerPoint 2013+ "Value From Cells" data labels
	// (c15:dlblFieldTable cached text, gated per-point by
	// c15:showDataLabelsRange), distinct from a literal c:tx/c:rich override.
	describe('"Value From Cells" data labels (C2-G13)', () => {
		const fieldTableExtLst: XmlObject = {
			'c:ext': {
				'@_uri': '{CE6537A1-D6FC-4f65-9D91-7224C49458BB}',
				'c15:dlblFieldTable': {
					'c15:dlblFieldTableEntry': {
						'c15:f': 'Sheet1!$B$2:$B$4',
						'c15:dlblFieldTableCache': {
							'c:ptCount': { '@_val': '3' },
							'c:pt': [
								{ '@_idx': '0', 'c:v': 'Alpha' },
								{ '@_idx': '1', 'c:v': 'Beta' },
							],
						},
					},
				},
			},
		};

		it('resolves the cached cell text when c15:showDataLabelsRange is set', () => {
			const series: XmlObject = {
				'c:dLbls': {
					'c:extLst': fieldTableExtLst,
					'c:dLbl': {
						'c:idx': { '@_val': '0' },
						'c:extLst': { 'c:ext': { 'c15:showDataLabelsRange': { '@_val': '1' } } },
					},
				},
			};
			const [label] = parseSeriesDataLabels(series, lookup);
			expect(label.text).toBe('Alpha');
		});

		it('leaves text unset when showDataLabelsRange is absent even if a field table exists', () => {
			const series: XmlObject = {
				'c:dLbls': {
					'c:extLst': fieldTableExtLst,
					'c:dLbl': { 'c:idx': { '@_val': '1' } },
				},
			};
			const [label] = parseSeriesDataLabels(series, lookup);
			expect(label.text).toBeUndefined();
		});

		it('prefers a literal c:tx/c:rich override over the cell-range cache', () => {
			const series: XmlObject = {
				'c:dLbls': {
					'c:extLst': fieldTableExtLst,
					'c:dLbl': {
						'c:idx': { '@_val': '1' },
						'c:extLst': { 'c:ext': { 'c15:showDataLabelsRange': { '@_val': '1' } } },
						'c:tx': { 'c:rich': { 'a:p': { 'a:r': { 'a:t': 'Manual override' } } } },
					},
				},
			};
			const [label] = parseSeriesDataLabels(series, lookup);
			expect(label.text).toBe('Manual override');
		});
	});
});
