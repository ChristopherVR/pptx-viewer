import { describe, it, expect } from 'vitest';
import {
	PALETTE,
	computeValueRange,
	valueToY,
	formatAxisValue,
	seriesColor,
	paletteColor,
} from './chart-helpers';
import { getChartStylePalette } from './chart-style-palettes';
import type { PptxChartSeries } from 'pptx-viewer-core';

describe('computeValueRange', () => {
	it('should return default range for empty series', () => {
		const result = computeValueRange([]);
		expect(result).toEqual({ min: 0, max: 1, span: 1 });
	});

	it('should return default range for series with no values', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [] }];
		const result = computeValueRange(series);
		expect(result).toEqual({ min: 0, max: 1, span: 1 });
	});

	it('should compute range including zero for all-positive values', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [10, 20, 30] }];
		const result = computeValueRange(series);
		expect(result.min).toBe(0);
		expect(result.max).toBe(30);
		expect(result.span).toBe(30);
	});

	it('should compute range including zero for all-negative values', () => {
		const series: PptxChartSeries[] = [
			{ name: 'A', values: [-30, -20, -10] },
		];
		const result = computeValueRange(series);
		expect(result.min).toBe(-30);
		expect(result.max).toBe(0);
		expect(result.span).toBe(30);
	});

	it('should compute range for mixed positive and negative values', () => {
		const series: PptxChartSeries[] = [
			{ name: 'A', values: [-5, 0, 15] },
		];
		const result = computeValueRange(series);
		expect(result.min).toBe(-5);
		expect(result.max).toBe(15);
		expect(result.span).toBe(20);
	});

	it('should compute range across multiple series', () => {
		const series: PptxChartSeries[] = [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [5, 50] },
		];
		const result = computeValueRange(series);
		expect(result.min).toBe(0);
		expect(result.max).toBe(50);
		expect(result.span).toBe(50);
	});

	it('should enforce minimum span of 1 when all values are zero', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [0, 0, 0] }];
		const result = computeValueRange(series);
		expect(result.span).toBe(1);
	});

	it('should handle single value', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [42] }];
		const result = computeValueRange(series);
		expect(result.min).toBe(0);
		expect(result.max).toBe(42);
		expect(result.span).toBe(42);
	});
});

describe('valueToY', () => {
	it('should map min value to bottomY', () => {
		const range = { min: 0, max: 100, span: 100 };
		const result = valueToY(0, range, 10, 110);
		expect(result).toBe(110);
	});

	it('should map max value to topY', () => {
		const range = { min: 0, max: 100, span: 100 };
		const result = valueToY(100, range, 10, 110);
		expect(result).toBe(10);
	});

	it('should map midpoint value to midpoint Y', () => {
		const range = { min: 0, max: 100, span: 100 };
		const result = valueToY(50, range, 0, 200);
		expect(result).toBe(100);
	});

	it('should handle negative ranges', () => {
		const range = { min: -50, max: 50, span: 100 };
		const result = valueToY(0, range, 0, 100);
		expect(result).toBe(50);
	});

	it('should handle equal topY and bottomY', () => {
		const range = { min: 0, max: 100, span: 100 };
		const result = valueToY(50, range, 50, 50);
		expect(result).toBe(50);
	});

	it('should handle values outside the range', () => {
		const range = { min: 0, max: 100, span: 100 };
		const result = valueToY(150, range, 0, 100);
		expect(result).toBe(-50);
	});

	it('should correctly map quarter value', () => {
		const range = { min: 0, max: 100, span: 100 };
		const result = valueToY(25, range, 0, 100);
		expect(result).toBe(75);
	});

	it('should handle float values precisely', () => {
		const range = { min: 0, max: 10, span: 10 };
		const result = valueToY(3.3, range, 0, 100);
		expect(result).toBeCloseTo(67, 0);
	});
});

describe('formatAxisValue', () => {
	it('should format millions with M suffix', () => {
		expect(formatAxisValue(1_000_000)).toBe('1.0M');
		expect(formatAxisValue(2_500_000)).toBe('2.5M');
	});

	it('should format thousands with K suffix', () => {
		expect(formatAxisValue(1_000)).toBe('1.0K');
		expect(formatAxisValue(45_000)).toBe('45.0K');
	});

	it('should format integers as plain strings', () => {
		expect(formatAxisValue(0)).toBe('0');
		expect(formatAxisValue(42)).toBe('42');
		expect(formatAxisValue(999)).toBe('999');
	});

	it('should format decimals with one decimal place', () => {
		expect(formatAxisValue(3.14)).toBe('3.1');
		expect(formatAxisValue(0.7)).toBe('0.7');
	});

	it('should handle negative millions', () => {
		expect(formatAxisValue(-2_000_000)).toBe('-2.0M');
	});

	it('should handle negative thousands', () => {
		expect(formatAxisValue(-5_000)).toBe('-5.0K');
	});

	it('should handle negative integers', () => {
		expect(formatAxisValue(-7)).toBe('-7');
	});

	it('should handle negative decimals', () => {
		expect(formatAxisValue(-0.5)).toBe('-0.5');
	});
});

describe('seriesColor', () => {
	it('should return the series own color when present', () => {
		const series = { name: 'A', values: [], color: '#FF0000' } as PptxChartSeries;
		expect(seriesColor(series, 0)).toBe('#FF0000');
	});

	it('should fall back to palette color by index', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		expect(seriesColor(series, 0)).toBe(PALETTE[0]);
		expect(seriesColor(series, 1)).toBe(PALETTE[1]);
	});

	it('should wrap palette index when exceeding palette length', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		expect(seriesColor(series, PALETTE.length)).toBe(PALETTE[0]);
		expect(seriesColor(series, PALETTE.length + 1)).toBe(PALETTE[1]);
	});

	it('should prefer series color over palette even at index 0', () => {
		const series = { name: 'A', values: [], color: '#AABBCC' } as PptxChartSeries;
		expect(seriesColor(series, 0)).toBe('#AABBCC');
	});

	it('should use style palette when styleId is provided', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		const stylePalette = getChartStylePalette(1);
		expect(seriesColor(series, 0, 1)).toBe(stylePalette[0]);
		expect(seriesColor(series, 1, 1)).toBe(stylePalette[1]);
	});

	it('should still prefer series color even when styleId is provided', () => {
		const series = { name: 'A', values: [], color: '#FF0000' } as PptxChartSeries;
		expect(seriesColor(series, 0, 1)).toBe('#FF0000');
	});

	it('should use default palette when styleId is undefined', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		expect(seriesColor(series, 0, undefined)).toBe(PALETTE[0]);
	});

	it('should return different colours for different styleIds', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		const color1 = seriesColor(series, 0, 1);
		const color10 = seriesColor(series, 0, 10);
		// Style 1 (colorful) and style 10 (monochromatic) should differ
		expect(color1).not.toBe(color10);
	});
});

describe('paletteColor', () => {
	it('should return default palette colour when no styleId', () => {
		expect(paletteColor(0)).toBe(PALETTE[0]);
		expect(paletteColor(1)).toBe(PALETTE[1]);
	});

	it('should return style palette colour when styleId is provided', () => {
		const stylePalette = getChartStylePalette(2);
		expect(paletteColor(0, 2)).toBe(stylePalette[0]);
		expect(paletteColor(1, 2)).toBe(stylePalette[1]);
	});

	it('should wrap around palette length', () => {
		const stylePalette = getChartStylePalette(3);
		expect(paletteColor(stylePalette.length, 3)).toBe(stylePalette[0]);
	});
});
