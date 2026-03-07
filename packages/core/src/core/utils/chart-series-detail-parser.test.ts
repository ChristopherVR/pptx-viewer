import { describe, it, expect } from 'vitest';
import type { XmlObject } from '../types';
import {
	parseSeriesDataPoints,
	parseSeriesDataLabels,
	parseSeriesExplosion,
	parseMarker,
	parseShapeProps,
} from './chart-series-detail-parser';

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
	parseColor(
		fillNode: XmlObject | undefined,
	): string | undefined {
		if (!fillNode) return undefined;
		const srgb = fillNode['a:srgbClr'] as XmlObject | undefined;
		if (srgb?.['@_val']) return `#${srgb['@_val']}`;
		return undefined;
	},
};

describe('parseShapeProps', () => {
	it('should parse fill color and stroke from spPr', () => {
		const spPr: XmlObject = {
			'a:solidFill': {
				'a:srgbClr': { '@_val': 'FF0000' },
			},
			'a:ln': {
				'@_w': '12700',
				'a:solidFill': {
					'a:srgbClr': { '@_val': '00FF00' },
				},
			},
		};
		const result = parseShapeProps(spPr, xmlLookup, colorParser);
		expect(result).toEqual({
			fillColor: '#FF0000',
			strokeColor: '#00FF00',
			strokeWidth: 1,
		});
	});

	it('should return undefined for empty spPr', () => {
		expect(parseShapeProps({}, xmlLookup, colorParser)).toBeUndefined();
	});

	it('should return undefined for undefined', () => {
		expect(parseShapeProps(undefined, xmlLookup, colorParser)).toBeUndefined();
	});
});

describe('parseMarker', () => {
	it('should parse all symbol types', () => {
		const symbols = [
			'circle', 'dash', 'diamond', 'dot', 'none', 'picture',
			'plus', 'square', 'star', 'triangle', 'x', 'auto',
		] as const;
		for (const sym of symbols) {
			const marker: XmlObject = {
				'c:symbol': { '@_val': sym },
				'c:size': { '@_val': '7' },
			};
			const result = parseMarker(marker, xmlLookup, colorParser);
			expect(result).toBeDefined();
			expect(result?.symbol).toBe(sym);
			expect(result?.size).toBe(7);
		}
	});

	it('should parse marker with spPr', () => {
		const marker: XmlObject = {
			'c:symbol': { '@_val': 'circle' },
			'c:spPr': {
				'a:solidFill': { 'a:srgbClr': { '@_val': 'AABB00' } },
			},
		};
		const result = parseMarker(marker, xmlLookup, colorParser);
		expect(result?.symbol).toBe('circle');
		expect(result?.spPr?.fillColor).toBe('#AABB00');
	});

	it('should return undefined for unknown symbol', () => {
		const marker: XmlObject = {
			'c:symbol': { '@_val': 'unknownType' },
		};
		expect(parseMarker(marker, xmlLookup, colorParser)).toBeUndefined();
	});

	it('should return undefined for undefined input', () => {
		expect(parseMarker(undefined, xmlLookup, colorParser)).toBeUndefined();
	});
});

describe('parseSeriesDataPoints', () => {
	it('should parse dPt with spPr, explosion, and invertIfNegative', () => {
		const series: XmlObject = {
			'c:dPt': [
				{
					'c:idx': { '@_val': '0' },
					'c:spPr': {
						'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
					},
					'c:explosion': { '@_val': '25' },
					'c:invertIfNegative': { '@_val': '1' },
				},
				{
					'c:idx': { '@_val': '2' },
					'c:spPr': {
						'a:solidFill': { 'a:srgbClr': { '@_val': '0000FF' } },
					},
				},
			],
		};
		const result = parseSeriesDataPoints(series, xmlLookup, colorParser);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			idx: 0,
			spPr: { fillColor: '#FF0000' },
			explosion: 25,
			invertIfNegative: true,
		});
		expect(result[1]).toEqual({
			idx: 2,
			spPr: { fillColor: '#0000FF' },
		});
	});

	it('should skip dPt without valid idx', () => {
		const series: XmlObject = {
			'c:dPt': {
				'c:idx': {},
			},
		};
		const result = parseSeriesDataPoints(series, xmlLookup, colorParser);
		expect(result).toHaveLength(0);
	});

	it('should return empty array when no dPt', () => {
		expect(parseSeriesDataPoints({}, xmlLookup, colorParser)).toEqual([]);
	});

	it('should parse dPt with marker', () => {
		const series: XmlObject = {
			'c:dPt': {
				'c:idx': { '@_val': '1' },
				'c:marker': {
					'c:symbol': { '@_val': 'diamond' },
					'c:size': { '@_val': '10' },
				},
			},
		};
		const result = parseSeriesDataPoints(series, xmlLookup, colorParser);
		expect(result).toHaveLength(1);
		expect(result[0].marker).toEqual({
			symbol: 'diamond',
			size: 10,
		});
	});
});

describe('parseSeriesDataLabels', () => {
	it('should parse individual dLbl with position and visibility', () => {
		const series: XmlObject = {
			'c:dLbl': [
				{
					'c:idx': { '@_val': '0' },
					'c:showVal': { '@_val': '1' },
					'c:showCatName': { '@_val': '0' },
					'c:dLblPos': { '@_val': 'outEnd' },
				},
				{
					'c:idx': { '@_val': '3' },
					'c:showPercent': { '@_val': '1' },
					'c:tx': {
						'c:rich': {
							'a:p': { 'a:r': { 'a:t': 'Custom Label' } },
						},
					},
				},
			],
		};
		const result = parseSeriesDataLabels(series, xmlLookup);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			idx: 0,
			showVal: true,
			showCatName: false,
			position: 'outEnd',
		});
		expect(result[1]).toEqual({
			idx: 3,
			showPercent: true,
			text: 'Custom Label',
		});
	});

	it('should return empty array when no dLbl', () => {
		expect(parseSeriesDataLabels({}, xmlLookup)).toEqual([]);
	});
});

describe('parseSeriesExplosion', () => {
	it('should parse explosion value from series', () => {
		const series: XmlObject = {
			'c:explosion': { '@_val': '25' },
		};
		expect(parseSeriesExplosion(series, xmlLookup)).toBe(25);
	});

	it('should return undefined when no explosion', () => {
		expect(parseSeriesExplosion({}, xmlLookup)).toBeUndefined();
	});

	it('should handle zero explosion', () => {
		const series: XmlObject = {
			'c:explosion': { '@_val': '0' },
		};
		expect(parseSeriesExplosion(series, xmlLookup)).toBe(0);
	});
});
