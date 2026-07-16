import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { parseCxChartSeries } from './chart-cx-parser';

/** Minimal XmlLookupLike stub using plain object traversal. */
const xmlLookup = {
	getChildByLocalName(parent: XmlObject | undefined, localName: string): XmlObject | undefined {
		if (!parent) {
			return undefined;
		}
		for (const key of Object.keys(parent)) {
			const parts = key.split(':');
			const local = parts[parts.length - 1];
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
			const parts = key.split(':');
			const local = parts[parts.length - 1];
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
			const parts = key.split(':');
			const local = parts[parts.length - 1];
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

describe('parseCxChartSeries', () => {
	it('should return undefined when no plotAreaRegion', () => {
		const plotArea: XmlObject = {};
		expect(parseCxChartSeries(plotArea, xmlLookup)).toBeUndefined();
	});

	it('should return undefined when plotAreaRegion has no series', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {},
		};
		expect(parseCxChartSeries(plotArea, xmlLookup)).toBeUndefined();
	});

	it('should parse a single cx: series with categories and values', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'@_layoutId': 'waterfall',
					'cx:tx': {
						'cx:txData': {
							'cx:v': 'Revenue',
						},
					},
					'cx:data': {
						'cx:strDim': {
							'cx:lvl': {
								'cx:pt': [{ 'cx:v': 'Q1' }, { 'cx:v': 'Q2' }, { 'cx:v': 'Q3' }],
							},
						},
						'cx:numDim': {
							'cx:lvl': {
								'cx:pt': [{ 'cx:v': '100' }, { 'cx:v': '150' }, { 'cx:v': '200' }],
							},
						},
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result).toBeDefined();
		expect(result!.categories).toStrictEqual(['Q1', 'Q2', 'Q3']);
		expect(result!.series).toHaveLength(1);
		expect(result!.series[0].name).toBe('Revenue');
		expect(result!.series[0].values).toStrictEqual([100, 150, 200]);
	});

	it('parses waterfall subtotals and connector visibility', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'@_layoutId': 'waterfall',
					'cx:data': {
						'cx:strDim': { 'cx:lvl': { 'cx:pt': [{ 'cx:v': 'A' }, { 'cx:v': 'B' }] } },
						'cx:numDim': { 'cx:lvl': { 'cx:pt': [{ 'cx:v': '10' }, { 'cx:v': '20' }] } },
					},
					'cx:layoutPr': {
						'cx:visibility': { '@_connectorLines': 'false' },
						'cx:subtotals': {
							'cx:idx': [{ '@_val': '0' }, { '@_val': '2' }, { '@_val': '-1' }],
						},
					},
				},
			},
		};
		expect(parseCxChartSeries(plotArea, xmlLookup)?.series[0].waterfallOptions).toStrictEqual({
			connectorLines: false,
			subtotalIndices: [0, 2],
		});
	});

	it('should parse multiple cx: series', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': [
					{
						'cx:tx': { 'cx:txData': { 'cx:v': 'Series A' } },
						'cx:data': {
							'cx:strDim': {
								'cx:lvl': {
									'cx:pt': [{ 'cx:v': 'Cat1' }, { 'cx:v': 'Cat2' }],
								},
							},
							'cx:numDim': {
								'cx:lvl': {
									'cx:pt': [{ 'cx:v': '10' }, { 'cx:v': '20' }],
								},
							},
						},
					},
					{
						'cx:tx': { 'cx:txData': { 'cx:v': 'Series B' } },
						'cx:data': {
							'cx:numDim': {
								'cx:lvl': {
									'cx:pt': [{ 'cx:v': '30' }, { 'cx:v': '40' }],
								},
							},
						},
					},
				],
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result).toBeDefined();
		expect(result!.categories).toStrictEqual(['Cat1', 'Cat2']);
		expect(result!.series).toHaveLength(2);
		expect(result!.series[0].name).toBe('Series A');
		expect(result!.series[0].values).toStrictEqual([10, 20]);
		expect(result!.series[1].name).toBe('Series B');
		expect(result!.series[1].values).toStrictEqual([30, 40]);
	});

	it('should use fallback name when tx is missing', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'cx:data': {
						'cx:numDim': {
							'cx:lvl': {
								'cx:pt': [{ 'cx:v': '5' }],
							},
						},
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result).toBeDefined();
		expect(result!.series[0].name).toBe('Series 1');
		expect(result!.series[0].values).toStrictEqual([5]);
	});

	it('should use [0] fallback when no numDim data', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'cx:tx': { 'cx:txData': { 'cx:v': 'Empty' } },
					'cx:data': {},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result).toBeDefined();
		expect(result!.series[0].values).toStrictEqual([0]);
	});

	it('should extract series color from spPr > solidFill > srgbClr', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'cx:tx': { 'cx:txData': { 'cx:v': 'Colored' } },
					'cx:data': {
						'cx:numDim': {
							'@_type': 'val',
							'cx:lvl': {
								'cx:pt': [{ 'cx:v': '42' }],
							},
						},
					},
					'cx:spPr': {
						'a:solidFill': {
							'a:srgbClr': { '@_val': 'FF5733' },
						},
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result).toBeDefined();
		expect(result!.series[0].color).toBe('#FF5733');
	});

	it('should set hasDataLabels when dataLabels with visibility is present', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'cx:tx': { 'cx:txData': { 'cx:v': 'Labeled' } },
					'cx:data': {
						'cx:numDim': {
							'cx:lvl': {
								'cx:pt': [{ 'cx:v': '10' }],
							},
						},
					},
					'cx:dataLabels': {
						'cx:visibility': {
							'@_value': '1',
							'@_categoryName': '1',
						},
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result).toBeDefined();
		expect(result!.hasDataLabels).toBeTruthy();
	});

	it('should not set hasDataLabels when no dataLabels present', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'cx:tx': { 'cx:txData': { 'cx:v': 'Plain' } },
					'cx:data': {
						'cx:numDim': {
							'cx:lvl': {
								'cx:pt': [{ 'cx:v': '5' }],
							},
						},
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result).toBeDefined();
		expect(result!.hasDataLabels).toBeFalsy();
	});

	it('should handle multiple numDim elements with typed dimension', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'cx:tx': { 'cx:txData': { 'cx:v': 'Multi' } },
					'cx:data': {
						'cx:numDim': {
							'@_type': 'val',
							'cx:lvl': {
								'cx:pt': [{ 'cx:v': '100' }, { 'cx:v': '200' }],
							},
						},
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result).toBeDefined();
		expect(result!.series[0].values).toStrictEqual([100, 200]);
	});

	it('resolves schema-standard chartData references and direct point text', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'@_layoutId': 'funnel',
					'cx:tx': { 'cx:txData': { 'cx:v': 'Pipeline' } },
					'cx:dataId': { '@_val': '7' },
				},
			},
		};
		const chartSpace: XmlObject = {
			'cx:chartData': {
				'cx:data': {
					'@_id': '7',
					'cx:strDim': {
						'@_type': 'cat',
						'cx:lvl': { 'cx:pt': [{ '@_idx': '0', '#text': 'Lead' }] },
					},
					'cx:numDim': {
						'@_type': 'val',
						'cx:lvl': { 'cx:pt': [{ '@_idx': '0', '#text': '42' }] },
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup, chartSpace);
		expect(result?.categories).toStrictEqual(['Lead']);
		expect(result?.series[0]).toMatchObject({ name: 'Pipeline', values: [42] });
	});

	it('preserves all hierarchical category levels while exposing leaf categories', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'@_layoutId': 'sunburst',
					'cx:data': {
						'cx:strDim': {
							'@_type': 'cat',
							'cx:lvl': [
								{ 'cx:pt': [{ '#text': 'Laptop' }, { '#text': 'Cloud' }] },
								{ 'cx:pt': [{ '#text': 'Hardware' }, { '#text': 'Software' }] },
								{ 'cx:pt': [{ '#text': 'North' }, { '#text': 'South' }] },
							],
						},
						'cx:numDim': {
							'@_type': 'size',
							'cx:lvl': { 'cx:pt': [{ '#text': '65' }, { '#text': '25' }] },
						},
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result?.categories).toStrictEqual(['Laptop', 'Cloud']);
		expect(result?.categoryLevels).toStrictEqual([
			['Laptop', 'Cloud'],
			['Hardware', 'Software'],
			['North', 'South'],
		]);
	});

	it('parses box-and-whisker visibility and statistics options', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'@_layoutId': 'boxWhisker',
					'cx:data': {
						'cx:numDim': {
							'@_type': 'val',
							'cx:lvl': { 'cx:pt': [{ '#text': '10' }, { '#text': '20' }] },
						},
					},
					'cx:layoutPr': {
						'cx:visibility': {
							'@_meanLine': '1',
							'@_meanMarker': '0',
							'@_nonoutliers': 'true',
							'@_outliers': 'false',
						},
						'cx:statistics': { '@_quartileMethod': 'exclusive' },
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result?.series[0].boxWhiskerOptions).toStrictEqual({
			quartileMethod: 'exclusive',
			showMeanLine: true,
			showMeanMarker: false,
			showInnerPoints: true,
			showOutlierPoints: false,
		});
	});

	it('parses histogram binning and Pareto series layouts', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': [
					{
						'@_layoutId': 'clusteredColumn',
						'cx:data': {
							'cx:numDim': { 'cx:lvl': { 'cx:pt': [{ '#text': '7' }] } },
						},
						'cx:layoutPr': {
							'cx:binning': {
								'@_intervalClosed': 'l',
								'@_underflow': '-5',
								'@_overflow': 'auto',
								'cx:binSize': 2.5,
							},
						},
					},
					{
						'@_layoutId': 'paretoLine',
						'cx:data': {
							'cx:numDim': { 'cx:lvl': { 'cx:pt': [{ '#text': '100' }] } },
						},
					},
				],
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result?.series[0].histogramOptions).toStrictEqual({
			layout: 'histogram',
			binSize: 2.5,
			intervalClosed: 'l',
			underflow: -5,
			overflow: 'auto',
		});
		expect(result?.series[1].histogramOptions).toStrictEqual({ layout: 'pareto' });
	});

	it('parses region-map entity IDs and geographic layout properties', () => {
		const plotArea: XmlObject = {
			'cx:plotAreaRegion': {
				'cx:series': {
					'@_layoutId': 'regionMap',
					'cx:data': {
						'cx:strDim': [
							{
								'@_type': 'cat',
								'cx:lvl': {
									'cx:pt': [
										{ '@_idx': '2', '#text': 'AU' },
										{ '@_idx': '5', '#text': 'US' },
									],
								},
							},
							{
								'@_type': 'entityId',
								'cx:lvl': {
									'cx:pt': [
										{ '@_idx': '2', '#text': 'country:AU' },
										{ '@_idx': '5', '#text': 'country:US' },
									],
								},
							},
						],
						'cx:numDim': {
							'@_type': 'colorVal',
							'cx:lvl': {
								'cx:pt': [
									{ '@_idx': '2', '#text': '72' },
									{ '@_idx': '5', '#text': '95' },
								],
							},
						},
					},
					'cx:layoutPr': {
						'cx:regionLabelLayout': { '@_val': 'bestFitOnly' },
						'cx:geography': {
							'@_projectionType': 'albers',
							'@_viewedRegionType': 'countryRegion',
							'@_cultureLanguage': 'en-AU',
							'@_cultureRegion': 'AU',
							'@_attribution': 'Microsoft',
							'cx:geoCache': {
								'@_provider': 'Bing',
								'cx:geoData': { '@_entityId': 'country:AU', '@_entityName': 'Australia' },
							},
						},
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result?.categories).toStrictEqual(['AU', 'US']);
		expect(result?.series[0]).toMatchObject({
			values: [72, 95],
			regionMapOptions: {
				entityIds: ['country:AU', 'country:US'],
				categorySourceIndices: [2, 5],
				valueSourceIndices: [2, 5],
				entityIdSourceIndices: [2, 5],
				regionLabelLayout: 'bestFitOnly',
				projectionType: 'albers',
				viewedRegionType: 'countryRegion',
				cultureLanguage: 'en-AU',
				cultureRegion: 'AU',
				attribution: 'Microsoft',
				geographyCache: {
					'@_provider': 'Bing',
					'cx:geoData': { '@_entityId': 'country:AU', '@_entityName': 'Australia' },
				},
			},
		});
	});
});
