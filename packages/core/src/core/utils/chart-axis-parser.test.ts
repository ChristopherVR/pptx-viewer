import { describe, it, expect } from 'vitest';
import type { XmlObject } from '../types';
import { parseChartAxes, parseChart3DSurfaces } from './chart-axis-parser';

const xmlLookup = {
	getChildByLocalName(
		parent: XmlObject | undefined,
		name: string,
	): XmlObject | undefined {
		if (!parent) return undefined;
		for (const key of Object.keys(parent)) {
			const localName = key.includes(':') ? key.split(':').pop() : key;
			if (localName === name) return parent[key] as XmlObject | undefined;
		}
		return undefined;
	},
	getChildrenArrayByLocalName(
		parent: XmlObject | undefined,
		name: string,
	): XmlObject[] {
		if (!parent) return [];
		for (const key of Object.keys(parent)) {
			const localName = key.includes(':') ? key.split(':').pop() : key;
			if (localName === name) {
				const val = parent[key];
				return Array.isArray(val) ? (val as XmlObject[]) : [val as XmlObject];
			}
		}
		return [];
	},
};

const colorParser = {
	parseColor(fillNode: XmlObject | undefined): string | undefined {
		if (!fillNode) return undefined;
		const srgb = fillNode['a:srgbClr'] as XmlObject | undefined;
		if (srgb?.['@_val']) return `#${srgb['@_val']}`;
		return undefined;
	},
};

const getLocalName = (key: string): string => {
	const parts = key.split(':');
	return parts.length > 1 ? parts[parts.length - 1] : key;
};

describe('parseChartAxes', () => {
	it('should parse category and value axes', () => {
		const plotArea: XmlObject = {
			'c:catAx': {
				'c:numFmt': {
					'@_formatCode': 'General',
					'@_sourceLinked': '1',
				},
				'c:title': {
					'c:tx': {
						'c:rich': {
							'a:p': { 'a:r': { 'a:t': 'Categories' } },
						},
					},
				},
				'c:txPr': {
					'a:p': {
						'a:pPr': {
							'a:defRPr': {
								'@_sz': '1000',
								'@_b': '1',
								'a:latin': { '@_typeface': 'Arial' },
								'a:solidFill': {
									'a:srgbClr': { '@_val': '333333' },
								},
							},
						},
					},
				},
			},
			'c:valAx': {
				'c:numFmt': {
					'@_formatCode': '#,##0',
				},
				'c:majorGridlines': {
					'c:spPr': {
						'a:ln': {
							'@_w': '12700',
							'a:solidFill': {
								'a:srgbClr': { '@_val': 'CCCCCC' },
							},
						},
					},
				},
			},
			'c:barChart': {},
		};

		const result = parseChartAxes(plotArea, xmlLookup, colorParser, getLocalName);
		expect(result).toHaveLength(2);

		const catAx = result.find((a) => a.axisType === 'catAx');
		expect(catAx).toBeDefined();
		expect(catAx?.numFmt?.formatCode).toBe('General');
		expect(catAx?.numFmt?.sourceLinked).toBe(true);
		expect(catAx?.titleText).toBe('Categories');
		expect(catAx?.fontSize).toBe(10);
		expect(catAx?.fontBold).toBe(true);
		expect(catAx?.fontFamily).toBe('Arial');
		expect(catAx?.fontColor).toBe('#333333');

		const valAx = result.find((a) => a.axisType === 'valAx');
		expect(valAx).toBeDefined();
		expect(valAx?.numFmt?.formatCode).toBe('#,##0');
		expect(valAx?.majorGridlinesSpPr).toEqual({
			strokeColor: '#CCCCCC',
			strokeWidth: 1,
		});
	});

	it('should return empty array for plotArea without axes', () => {
		const plotArea: XmlObject = { 'c:barChart': {} };
		const result = parseChartAxes(plotArea, xmlLookup, colorParser, getLocalName);
		expect(result).toEqual([]);
	});

	it('should parse logarithmic scale from c:scaling/c:logBase', () => {
		const plotArea: XmlObject = {
			'c:valAx': {
				'c:scaling': {
					'c:logBase': { '@_val': '10' },
					'c:min': { '@_val': '1' },
					'c:max': { '@_val': '10000' },
				},
			},
		};

		const result = parseChartAxes(plotArea, xmlLookup, colorParser, getLocalName);
		expect(result).toHaveLength(1);

		const valAx = result[0];
		expect(valAx.axisType).toBe('valAx');
		expect(valAx.logScale).toBe(true);
		expect(valAx.logBase).toBe(10);
		expect(valAx.min).toBe(1);
		expect(valAx.max).toBe(10000);
	});

	it('should parse log base 2', () => {
		const plotArea: XmlObject = {
			'c:valAx': {
				'c:scaling': {
					'c:logBase': { '@_val': '2' },
				},
			},
		};

		const result = parseChartAxes(plotArea, xmlLookup, colorParser, getLocalName);
		const valAx = result[0];
		expect(valAx.logScale).toBe(true);
		expect(valAx.logBase).toBe(2);
	});

	it('should not set logScale when scaling has no logBase', () => {
		const plotArea: XmlObject = {
			'c:valAx': {
				'c:scaling': {
					'c:min': { '@_val': '0' },
					'c:max': { '@_val': '100' },
				},
			},
		};

		const result = parseChartAxes(plotArea, xmlLookup, colorParser, getLocalName);
		const valAx = result[0];
		expect(valAx.logScale).toBeUndefined();
		expect(valAx.logBase).toBeUndefined();
		expect(valAx.min).toBe(0);
		expect(valAx.max).toBe(100);
	});

	it('should parse axisId and crossAxisId', () => {
		const plotArea: XmlObject = {
			'c:valAx': {
				'c:axId': { '@_val': '123456' },
				'c:crossAx': { '@_val': '789012' },
			},
		};

		const result = parseChartAxes(plotArea, xmlLookup, colorParser, getLocalName);
		const valAx = result[0];
		expect(valAx.axisId).toBe(123456);
		expect(valAx.crossAxisId).toBe(789012);
	});

	it('should parse deleted axis', () => {
		const plotArea: XmlObject = {
			'c:valAx': {
				'c:delete': { '@_val': '1' },
			},
		};

		const result = parseChartAxes(plotArea, xmlLookup, colorParser, getLocalName);
		const valAx = result[0];
		expect(valAx.deleted).toBe(true);
	});

	it('should ignore invalid logBase values', () => {
		const plotArea: XmlObject = {
			'c:valAx': {
				'c:scaling': {
					'c:logBase': { '@_val': 'invalid' },
				},
			},
		};

		const result = parseChartAxes(plotArea, xmlLookup, colorParser, getLocalName);
		const valAx = result[0];
		expect(valAx.logScale).toBeUndefined();
		expect(valAx.logBase).toBeUndefined();
	});
});

describe('parseChart3DSurfaces', () => {
	it('should parse floor, sideWall, and backWall', () => {
		const chartRoot: XmlObject = {
			'c:floor': {
				'c:thickness': { '@_val': '5' },
				'c:spPr': {
					'a:solidFill': { 'a:srgbClr': { '@_val': 'EEEEEE' } },
				},
			},
			'c:sideWall': {
				'c:spPr': {
					'a:solidFill': { 'a:srgbClr': { '@_val': 'DDDDDD' } },
				},
			},
			'c:backWall': {
				'c:thickness': { '@_val': '3' },
			},
		};

		const result = parseChart3DSurfaces(chartRoot, xmlLookup, colorParser);
		expect(result.floor).toEqual({
			thickness: 5,
			spPr: { fillColor: '#EEEEEE' },
		});
		expect(result.sideWall).toEqual({
			spPr: { fillColor: '#DDDDDD' },
		});
		expect(result.backWall).toEqual({
			thickness: 3,
		});
	});

	it('should return empty object when no surfaces', () => {
		const result = parseChart3DSurfaces({}, xmlLookup, colorParser);
		expect(result).toEqual({});
	});
});
