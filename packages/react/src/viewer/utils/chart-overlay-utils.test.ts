import { describe, it, expect } from 'vitest';
import {
	PALETTE,
	sColor,
	valToY,
	xToPixel,
} from './chart-overlay-utils';
import type { PptxChartSeries } from 'pptx-viewer-core';
import type { ChartPlotLayout, ChartValueRange } from './chart-overlay-utils';

describe('PALETTE', () => {
	it('should have 8 colours', () => {
		expect(PALETTE.length).toBe(8);
	});

	it('should contain valid hex colour strings', () => {
		for (const color of PALETTE) {
			expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
		}
	});
});

describe('sColor', () => {
	it('should return the series own colour when present', () => {
		const series = { name: 'A', values: [], color: '#AABB00' } as PptxChartSeries;
		expect(sColor(series, 0)).toBe('#AABB00');
	});

	it('should fall back to PALETTE by index', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		expect(sColor(series, 0)).toBe(PALETTE[0]);
		expect(sColor(series, 3)).toBe(PALETTE[3]);
	});

	it('should wrap PALETTE index', () => {
		const series = { name: 'A', values: [] } as PptxChartSeries;
		expect(sColor(series, PALETTE.length)).toBe(PALETTE[0]);
	});

	it('should prefer own colour over PALETTE', () => {
		const series = { name: 'A', values: [], color: '#FF0000' } as PptxChartSeries;
		expect(sColor(series, 5)).toBe('#FF0000');
	});
});

describe('valToY', () => {
	it('should map min value to bottomY', () => {
		const range: ChartValueRange = { min: 0, max: 100, span: 100 };
		expect(valToY(0, range, 10, 110)).toBe(110);
	});

	it('should map max value to topY', () => {
		const range: ChartValueRange = { min: 0, max: 100, span: 100 };
		expect(valToY(100, range, 10, 110)).toBe(10);
	});

	it('should map midpoint to middle of vertical range', () => {
		const range: ChartValueRange = { min: 0, max: 100, span: 100 };
		expect(valToY(50, range, 0, 200)).toBe(100);
	});

	it('should handle negative value ranges', () => {
		const range: ChartValueRange = { min: -50, max: 50, span: 100 };
		expect(valToY(0, range, 0, 100)).toBe(50);
	});

	it('should handle equal topY and bottomY', () => {
		const range: ChartValueRange = { min: 0, max: 100, span: 100 };
		expect(valToY(50, range, 50, 50)).toBe(50);
	});

	it('should handle values beyond range', () => {
		const range: ChartValueRange = { min: 0, max: 100, span: 100 };
		expect(valToY(200, range, 0, 100)).toBe(-100);
	});

	it('should be consistent with chart-helpers valueToY', () => {
		// valToY and valueToY have the same formula
		const range: ChartValueRange = { min: 10, max: 90, span: 80 };
		const result = valToY(50, range, 20, 180);
		const usable = 180 - 20;
		const expected = 180 - ((50 - 10) / 80) * usable;
		expect(result).toBe(expected);
	});

	it('should return bottomY for value equal to min', () => {
		const range: ChartValueRange = { min: 5, max: 95, span: 90 };
		expect(valToY(5, range, 10, 190)).toBe(190);
	});
});

describe('xToPixel', () => {
	const layout: ChartPlotLayout = {
		plotLeft: 50,
		plotTop: 10,
		plotRight: 350,
		plotBottom: 250,
		plotWidth: 300,
		plotHeight: 240,
		svgWidth: 400,
		svgHeight: 300,
	};

	it('should compute bar centre for bar mode', () => {
		// 3 categories, index 0
		const result = xToPixel(0, 3, layout, 'bar');
		const slotWidth = 300 / 3;
		const expected = 50 + slotWidth * 0 + slotWidth / 2;
		expect(result).toBe(expected);
	});

	it('should compute bar centre for middle category', () => {
		const result = xToPixel(1, 3, layout, 'bar');
		const slotWidth = 300 / 3;
		const expected = 50 + slotWidth * 1 + slotWidth / 2;
		expect(result).toBe(expected);
	});

	it('should compute bar centre for last category', () => {
		const result = xToPixel(2, 3, layout, 'bar');
		const slotWidth = 300 / 3;
		const expected = 50 + slotWidth * 2 + slotWidth / 2;
		expect(result).toBe(expected);
	});

	it('should handle single category bar mode', () => {
		const result = xToPixel(0, 1, layout, 'bar');
		const slotWidth = 300 / 1;
		expect(result).toBe(50 + slotWidth / 2);
	});

	it('should handle zero categories bar mode without dividing by zero', () => {
		const result = xToPixel(0, 0, layout, 'bar');
		// catCount is clamped to 1 by Math.max
		expect(Number.isFinite(result)).toBe(true);
	});

	it('should compute line position for first point', () => {
		const result = xToPixel(0, 5, layout, 'line');
		expect(result).toBe(layout.plotLeft);
	});

	it('should compute line position for last point', () => {
		const result = xToPixel(4, 5, layout, 'line');
		expect(result).toBe(layout.plotLeft + layout.plotWidth);
	});

	it('should compute line position for middle point', () => {
		const result = xToPixel(2, 5, layout, 'line');
		const maxIdx = 4;
		const expected = layout.plotLeft + (2 / maxIdx) * layout.plotWidth;
		expect(result).toBe(expected);
	});

	it('should handle single category line mode without dividing by zero', () => {
		const result = xToPixel(0, 1, layout, 'line');
		// maxIdx = Math.max(0, 1) = 1, so x=0/1*plotWidth + plotLeft
		expect(result).toBe(layout.plotLeft);
	});
});
