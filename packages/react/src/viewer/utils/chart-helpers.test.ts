import { describe, it, expect } from 'vitest';
import {
	PALETTE,
	computeValueRange,
	computeValueRangeForChart,
	computeLogValueRange,
	valueToY,
	valueToYLog,
	generateLogTicks,
	findLogAxis,
	formatAxisValue,
	seriesColor,
	paletteColor,
} from './chart-helpers';
import { getChartStylePalette } from './chart-style-palettes';
import type { PptxChartSeries, PptxChartAxisFormatting } from 'pptx-viewer-core';

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

describe('computeLogValueRange', () => {
	it('should return default log range for empty series', () => {
		const result = computeLogValueRange([], 10);
		expect(result.min).toBe(1);
		expect(result.max).toBe(10);
		expect(result.span).toBe(1);
		expect(result.logScale).toBe(true);
		expect(result.logBase).toBe(10);
	});

	it('should return default log range when all values are non-positive', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [-5, 0, -10] }];
		const result = computeLogValueRange(series, 10);
		expect(result.min).toBe(1);
		expect(result.max).toBe(10);
		expect(result.logScale).toBe(true);
	});

	it('should snap to power-of-base boundaries for base 10', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [5, 50, 500] }];
		const result = computeLogValueRange(series, 10);
		// 5 -> floor(log10(5)) = 0, so min = 10^0 = 1
		// 500 -> ceil(log10(500)) = 3, so max = 10^3 = 1000
		expect(result.min).toBe(1);
		expect(result.max).toBe(1000);
		expect(result.span).toBeCloseTo(3, 10); // log10(1000) - log10(1) = 3
		expect(result.logScale).toBe(true);
		expect(result.logBase).toBe(10);
	});

	it('should snap to power-of-base boundaries for base 2', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [3, 12, 50] }];
		const result = computeLogValueRange(series, 2);
		// 3 -> floor(log2(3)) = 1, so min = 2^1 = 2
		// 50 -> ceil(log2(50)) = 6, so max = 2^6 = 64
		expect(result.min).toBe(2);
		expect(result.max).toBe(64);
		expect(result.logScale).toBe(true);
		expect(result.logBase).toBe(2);
	});

	it('should handle values that are exact powers of base', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [10, 100, 1000] }];
		const result = computeLogValueRange(series, 10);
		expect(result.min).toBe(10);
		expect(result.max).toBe(1000);
		expect(result.span).toBeCloseTo(2, 10); // log10(1000) - log10(10) = 2
	});

	it('should ensure minimum span of 1', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [100] }];
		const result = computeLogValueRange(series, 10);
		// Single value at 100 -> logMin = 2, logMax = 2, forced to logMax = logMin+1
		expect(result.span).toBeGreaterThanOrEqual(1);
	});

	it('should filter out non-positive values', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [-10, 0, 5, 50] }];
		const result = computeLogValueRange(series, 10);
		// Only 5 and 50 should be considered
		expect(result.min).toBe(1); // floor(log10(5))=0 -> 10^0 = 1
		expect(result.max).toBe(100); // ceil(log10(50))=2 -> 10^2 = 100
	});
});

describe('valueToY with log scale', () => {
	it('should delegate to valueToYLog when range has logScale', () => {
		const range = { min: 1, max: 1000, span: 3, logScale: true, logBase: 10 };
		// min value (1) should map to bottomY
		const resultMin = valueToY(1, range, 0, 300);
		expect(resultMin).toBeCloseTo(300, 0);
		// max value (1000) should map to topY
		const resultMax = valueToY(1000, range, 0, 300);
		expect(resultMax).toBeCloseTo(0, 0);
	});

	it('should still use linear for ranges without logScale', () => {
		const range = { min: 0, max: 100, span: 100 };
		const result = valueToY(50, range, 0, 200);
		expect(result).toBe(100);
	});
});

describe('valueToYLog', () => {
	it('should map min value to bottomY', () => {
		const range = { min: 1, max: 1000, span: 3, logScale: true, logBase: 10 };
		const result = valueToYLog(1, range, 0, 300);
		expect(result).toBeCloseTo(300, 5);
	});

	it('should map max value to topY', () => {
		const range = { min: 1, max: 1000, span: 3, logScale: true, logBase: 10 };
		const result = valueToYLog(1000, range, 0, 300);
		expect(result).toBeCloseTo(0, 5);
	});

	it('should map intermediate log value correctly', () => {
		const range = { min: 1, max: 1000, span: 3, logScale: true, logBase: 10 };
		// 10 is at log10(10)=1, which is 1/3 of the span from min
		const result = valueToYLog(10, range, 0, 300);
		expect(result).toBeCloseTo(200, 0);
	});

	it('should map 100 correctly with base 10', () => {
		const range = { min: 1, max: 1000, span: 3, logScale: true, logBase: 10 };
		// 100 is at log10(100)=2, which is 2/3 of the span from min
		const result = valueToYLog(100, range, 0, 300);
		expect(result).toBeCloseTo(100, 0);
	});

	it('should clamp values below min', () => {
		const range = { min: 1, max: 1000, span: 3, logScale: true, logBase: 10 };
		const result = valueToYLog(0.001, range, 0, 300);
		// Should clamp to min=1, producing bottomY
		expect(result).toBeCloseTo(300, 5);
	});

	it('should work with base 2', () => {
		const range = { min: 1, max: 16, span: 4, logScale: true, logBase: 2 };
		// 4 is at log2(4)=2, which is 2/4 = 0.5 of the span
		const result = valueToYLog(4, range, 0, 400);
		expect(result).toBeCloseTo(200, 0);
	});

	it('should default to base 10 when logBase is undefined', () => {
		const range = { min: 1, max: 1000, span: 3, logScale: true };
		const result = valueToYLog(10, range, 0, 300);
		expect(result).toBeCloseTo(200, 0);
	});
});

describe('generateLogTicks', () => {
	it('should return empty array when not log scale', () => {
		const range = { min: 0, max: 100, span: 100 };
		expect(generateLogTicks(range)).toEqual([]);
	});

	it('should return empty array when logBase is missing', () => {
		const range = { min: 1, max: 1000, span: 3, logScale: true };
		expect(generateLogTicks(range)).toEqual([]);
	});

	it('should generate ticks at powers of 10', () => {
		const range = { min: 1, max: 1000, span: 3, logScale: true, logBase: 10 };
		const ticks = generateLogTicks(range);
		expect(ticks).toEqual([1, 10, 100, 1000]);
	});

	it('should generate ticks at powers of 2', () => {
		const range = { min: 1, max: 16, span: 4, logScale: true, logBase: 2 };
		const ticks = generateLogTicks(range);
		expect(ticks).toEqual([1, 2, 4, 8, 16]);
	});

	it('should handle single-decade range', () => {
		const range = { min: 10, max: 100, span: 1, logScale: true, logBase: 10 };
		const ticks = generateLogTicks(range);
		expect(ticks).toEqual([10, 100]);
	});

	it('should handle wide range', () => {
		const range = { min: 0.01, max: 100000, span: 7, logScale: true, logBase: 10 };
		const ticks = generateLogTicks(range);
		expect(ticks).toEqual([0.01, 0.1, 1, 10, 100, 1000, 10000, 100000]);
	});
});

describe('findLogAxis', () => {
	it('should return undefined for undefined axes', () => {
		expect(findLogAxis(undefined)).toBeUndefined();
	});

	it('should return undefined when no axes have logScale', () => {
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'catAx' },
			{ axisType: 'valAx' },
		];
		expect(findLogAxis(axes)).toBeUndefined();
	});

	it('should find the value axis with logScale', () => {
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'catAx' },
			{ axisType: 'valAx', logScale: true, logBase: 10 },
		];
		const result = findLogAxis(axes);
		expect(result).toBeDefined();
		expect(result?.axisType).toBe('valAx');
		expect(result?.logScale).toBe(true);
		expect(result?.logBase).toBe(10);
	});

	it('should not match catAx even if it has logScale', () => {
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'catAx', logScale: true, logBase: 10 } as PptxChartAxisFormatting,
		];
		expect(findLogAxis(axes)).toBeUndefined();
	});

	it('should return the first matching log axis', () => {
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'valAx', logScale: true, logBase: 10 },
			{ axisType: 'valAx', logScale: true, logBase: 2 },
		];
		const result = findLogAxis(axes);
		expect(result?.logBase).toBe(10);
	});
});

describe('computeValueRangeForChart', () => {
	it('should use linear range when no axes are provided', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [10, 20, 30] }];
		const result = computeValueRangeForChart(series);
		expect(result.logScale).toBeUndefined();
		expect(result.min).toBe(0);
		expect(result.max).toBe(30);
	});

	it('should use linear range when no log axis exists', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [10, 20, 30] }];
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'catAx' },
			{ axisType: 'valAx' },
		];
		const result = computeValueRangeForChart(series, axes);
		expect(result.logScale).toBeUndefined();
		expect(result.min).toBe(0);
		expect(result.max).toBe(30);
	});

	it('should use log range when a valAx has logScale and logBase', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [5, 50, 500] }];
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'catAx' },
			{ axisType: 'valAx', logScale: true, logBase: 10 },
		];
		const result = computeValueRangeForChart(series, axes);
		expect(result.logScale).toBe(true);
		expect(result.logBase).toBe(10);
		expect(result.min).toBe(1);
		expect(result.max).toBe(1000);
	});

	it('should use log range with base 2', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [3, 12, 50] }];
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'valAx', logScale: true, logBase: 2 },
		];
		const result = computeValueRangeForChart(series, axes);
		expect(result.logScale).toBe(true);
		expect(result.logBase).toBe(2);
		expect(result.min).toBe(2);
		expect(result.max).toBe(64);
	});

	it('should not use log range when logScale is true but logBase is missing', () => {
		const series: PptxChartSeries[] = [{ name: 'A', values: [10, 20, 30] }];
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'valAx', logScale: true },
		];
		const result = computeValueRangeForChart(series, axes);
		// findLogAxis returns the axis, but logBase is undefined so falls through to linear
		expect(result.logScale).toBeUndefined();
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

	it('should prefer colorPalette over styleId when both are provided', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		const customPalette = ['#AA0000', '#BB0000', '#CC0000'];
		expect(seriesColor(series, 0, 1, customPalette)).toBe('#AA0000');
		expect(seriesColor(series, 1, 1, customPalette)).toBe('#BB0000');
		expect(seriesColor(series, 2, 1, customPalette)).toBe('#CC0000');
	});

	it('should prefer colorPalette over default palette', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		const customPalette = ['#112233', '#445566'];
		expect(seriesColor(series, 0, undefined, customPalette)).toBe('#112233');
		expect(seriesColor(series, 1, undefined, customPalette)).toBe('#445566');
	});

	it('should wrap colorPalette when index exceeds length', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		const customPalette = ['#FF0000', '#00FF00'];
		expect(seriesColor(series, 2, undefined, customPalette)).toBe('#FF0000');
		expect(seriesColor(series, 3, undefined, customPalette)).toBe('#00FF00');
	});

	it('should still prefer series.color over colorPalette', () => {
		const series = { name: 'A', values: [], color: '#FFFFFF' } as PptxChartSeries;
		const customPalette = ['#000000'];
		expect(seriesColor(series, 0, undefined, customPalette)).toBe('#FFFFFF');
	});

	it('should ignore empty colorPalette and fall back to styleId palette', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		const stylePalette = getChartStylePalette(1);
		expect(seriesColor(series, 0, 1, [])).toBe(stylePalette[0]);
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

	it('should prefer colorPalette over styleId', () => {
		const customPalette = ['#AABBCC', '#DDEEFF'];
		expect(paletteColor(0, 2, customPalette)).toBe('#AABBCC');
		expect(paletteColor(1, 2, customPalette)).toBe('#DDEEFF');
	});

	it('should wrap colorPalette when index exceeds length', () => {
		const customPalette = ['#111111', '#222222', '#333333'];
		expect(paletteColor(3, undefined, customPalette)).toBe('#111111');
	});

	it('should ignore empty colorPalette and use default', () => {
		expect(paletteColor(0, undefined, [])).toBe(PALETTE[0]);
	});
});
