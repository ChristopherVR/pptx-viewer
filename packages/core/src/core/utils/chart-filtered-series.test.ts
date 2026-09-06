import { describe, expect, it } from 'vitest';

import { PptxXmlLookupService } from '../services/PptxXmlLookupService';
import type { XmlObject } from '../types';
import {
	assignSeriesIndices,
	CHART_FILTERED_SERIES_EXT_URI,
	collectFilteredSeriesIndices,
	parseFilteredSeries,
} from './chart-filtered-series';

const lookup = new PptxXmlLookupService();

/**
 * Real-shape fixture: `c:barChart/c:extLst/c:ext[uri=...]/c15:filteredBarSeries/c15:ser`,
 * captured verbatim (minus the surrounding barChart) from COM-authored
 * `e2e/fixtures/chart-filtered-series.pptx` (`Series.IsFiltered = True` on
 * series B of a 3-series/4-category column chart, one category also filtered).
 */
function filteredBarChartContainer(): XmlObject {
	return {
		'c:ser': [{ 'c:idx': { '@_val': '0' } }, { 'c:idx': { '@_val': '2' } }],
		'c:extLst': {
			'c:ext': {
				'@_uri': CHART_FILTERED_SERIES_EXT_URI,
				'c15:filteredBarSeries': {
					'c15:ser': {
						'c:idx': { '@_val': '1' },
						'c:order': { '@_val': '1' },
						'c:tx': {
							'c:strRef': {
								'c:strCache': {
									'c:ptCount': { '@_val': '1' },
									'c:pt': { '@_idx': '0', 'c:v': 'Series B' },
								},
							},
						},
						'c:cat': {
							'c:strRef': {
								'c:strCache': {
									'c:ptCount': { '@_val': '3' },
									'c:pt': [
										{ '@_idx': '0', 'c:v': 'Cat1' },
										{ '@_idx': '1', 'c:v': 'Cat2' },
										{ '@_idx': '2', 'c:v': 'Cat4' },
									],
								},
							},
						},
						'c:val': {
							'c:numRef': {
								'c:numCache': {
									'c:formatCode': 'General',
									'c:ptCount': { '@_val': '3' },
									'c:pt': [
										{ '@_idx': '0', 'c:v': '20' },
										{ '@_idx': '1', 'c:v': '21' },
										{ '@_idx': '2', 'c:v': '23' },
									],
								},
							},
						},
						'c:extLst': {
							'c:ext': {
								'@_uri': '{C3380CC4-5D6E-409C-BE32-E72D297353CC}',
								'c16:uniqueId': { '@_val': '{00000001-8DC8-49F7-A5E4-B5900CF34A44}' },
							},
						},
					},
				},
			},
		},
	};
}

describe('parseFilteredSeries', () => {
	it('returns undefined when the container has no filter extension', () => {
		expect(
			parseFilteredSeries({ 'c:ser': [{ 'c:idx': { '@_val': '0' } }] }, lookup),
		).toBeUndefined();
	});

	it('parses a real-shape c15:filteredBarSeries into name/categories/values/uniqueId', () => {
		const result = parseFilteredSeries(filteredBarChartContainer(), lookup);
		expect(result).toStrictEqual([
			{
				idx: 1,
				order: 1,
				name: 'Series B',
				categories: ['Cat1', 'Cat2', 'Cat4'],
				values: [20, 21, 23],
				uniqueId: '{00000001-8DC8-49F7-A5E4-B5900CF34A44}',
			},
		]);
	});

	it('matches filteredLineSeries / filteredPieSeries wrapper names too', () => {
		const line: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': CHART_FILTERED_SERIES_EXT_URI,
					'c15:filteredLineSeries': {
						'c15:ser': { 'c:idx': { '@_val': '3' } },
					},
				},
			},
		};
		expect(parseFilteredSeries(line, lookup)).toStrictEqual([{ idx: 3, order: 3 }]);

		const pie: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': CHART_FILTERED_SERIES_EXT_URI,
					'c15:filteredPieSeries': {
						'c15:ser': { 'c:idx': { '@_val': '5' } },
					},
				},
			},
		};
		expect(parseFilteredSeries(pie, lookup)).toStrictEqual([{ idx: 5, order: 5 }]);
	});

	it('ignores an extLst whose ext uri does not match', () => {
		const node: XmlObject = {
			'c:extLst': {
				'c:ext': {
					'@_uri': '{SOME-OTHER-EXTENSION}',
					'c15:filteredBarSeries': { 'c15:ser': { 'c:idx': { '@_val': '1' } } },
				},
			},
		};
		expect(parseFilteredSeries(node, lookup)).toBeUndefined();
	});
});

describe('collectFilteredSeriesIndices', () => {
	it('collects idx values reserved by filtered series', () => {
		expect(collectFilteredSeriesIndices(filteredBarChartContainer(), lookup)).toStrictEqual(
			new Set([1]),
		);
	});

	it('returns an empty set when there is no filter extension', () => {
		expect(collectFilteredSeriesIndices({ 'c:ser': [] }, lookup)).toStrictEqual(new Set());
	});
});

describe('assignSeriesIndices', () => {
	it('assigns a plain 0..N-1 sequence when nothing is reserved', () => {
		expect(assignSeriesIndices(3, new Set())).toStrictEqual([0, 1, 2]);
	});

	it('skips a reserved index in the middle, matching real PowerPoint idx gaps', () => {
		// Series A (visible), Series B (filtered, idx 1), Series C (visible):
		// two visible series must land on idx 0 and 2, never colliding with 1.
		expect(assignSeriesIndices(2, new Set([1]))).toStrictEqual([0, 2]);
	});

	it('skips multiple reserved indices and keeps assigning past them', () => {
		expect(assignSeriesIndices(3, new Set([0, 2]))).toStrictEqual([1, 3, 4]);
	});
});
