import { describe, it, expect } from 'vitest';
import type { XmlObject } from '../types';
import { parseCxChartSeries } from './chart-cx-parser';

/** Minimal XmlLookupLike stub using plain object traversal. */
const xmlLookup = {
	getChildByLocalName(
		parent: XmlObject | undefined,
		localName: string,
	): XmlObject | undefined {
		if (!parent) return undefined;
		for (const key of Object.keys(parent)) {
			const parts = key.split(':');
			const local = parts[parts.length - 1];
			if (local === localName && typeof parent[key] === 'object') {
				return parent[key] as XmlObject;
			}
		}
		return undefined;
	},
	getChildrenArrayByLocalName(
		parent: XmlObject | undefined,
		localName: string,
	): XmlObject[] {
		if (!parent) return [];
		for (const key of Object.keys(parent)) {
			const parts = key.split(':');
			const local = parts[parts.length - 1];
			if (local === localName) {
				const val = parent[key];
				if (Array.isArray(val)) return val as XmlObject[];
				if (typeof val === 'object' && val !== null) return [val as XmlObject];
			}
		}
		return [];
	},
	getScalarChildByLocalName(
		parent: XmlObject | undefined,
		localName: string,
	): string | number | boolean | undefined {
		if (!parent) return undefined;
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
								'cx:pt': [
									{ 'cx:v': 'Q1' },
									{ 'cx:v': 'Q2' },
									{ 'cx:v': 'Q3' },
								],
							},
						},
						'cx:numDim': {
							'cx:lvl': {
								'cx:pt': [
									{ 'cx:v': '100' },
									{ 'cx:v': '150' },
									{ 'cx:v': '200' },
								],
							},
						},
					},
				},
			},
		};

		const result = parseCxChartSeries(plotArea, xmlLookup);
		expect(result).toBeDefined();
		expect(result!.categories).toEqual(['Q1', 'Q2', 'Q3']);
		expect(result!.series).toHaveLength(1);
		expect(result!.series[0].name).toBe('Revenue');
		expect(result!.series[0].values).toEqual([100, 150, 200]);
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
		expect(result!.categories).toEqual(['Cat1', 'Cat2']);
		expect(result!.series).toHaveLength(2);
		expect(result!.series[0].name).toBe('Series A');
		expect(result!.series[0].values).toEqual([10, 20]);
		expect(result!.series[1].name).toBe('Series B');
		expect(result!.series[1].values).toEqual([30, 40]);
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
		expect(result!.series[0].values).toEqual([5]);
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
		expect(result!.series[0].values).toEqual([0]);
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
		expect(result!.hasDataLabels).toBe(true);
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
		expect(result!.series[0].values).toEqual([100, 200]);
	});
});
