import { describe, it, expect } from 'vitest';
import { computeLayout } from './chart-layout';
import type { PptxChartStyle } from 'pptx-viewer-core';

describe('computeLayout', () => {
	it('should enforce minimum SVG dimensions', () => {
		const layout = computeLayout(100, 50, undefined, false, 'b');
		expect(layout.svgWidth).toBe(320);
		expect(layout.svgHeight).toBe(180);
	});

	it('should use element dimensions when larger than minimums', () => {
		const layout = computeLayout(800, 600, undefined, false, 'b');
		expect(layout.svgWidth).toBe(800);
		expect(layout.svgHeight).toBe(600);
	});

	it('should reserve left padding for axes', () => {
		const withAxes = computeLayout(800, 600, undefined, true, 'b');
		const withoutAxes = computeLayout(800, 600, undefined, false, 'b');
		expect(withAxes.plotLeft).toBeGreaterThan(withoutAxes.plotLeft);
	});

	it('should reserve bottom padding for axes', () => {
		const withAxes = computeLayout(800, 600, undefined, true, 'b');
		const withoutAxes = computeLayout(800, 600, undefined, false, 'b');
		expect(withAxes.plotBottom).toBeLessThan(withoutAxes.plotBottom);
	});

	it('should adjust plotTop when chart has a title', () => {
		const style: PptxChartStyle = { hasTitle: true };
		const withTitle = computeLayout(800, 600, style, false, 'b');
		const noTitle = computeLayout(800, 600, undefined, false, 'b');
		expect(withTitle.plotTop).toBeGreaterThan(noTitle.plotTop);
	});

	it('should adjust plotBottom for bottom legend', () => {
		const style: PptxChartStyle = { hasLegend: true };
		const layout = computeLayout(800, 600, style, false, 'b');
		const noLegend = computeLayout(800, 600, undefined, false, 'b');
		expect(layout.plotBottom).toBeLessThan(noLegend.plotBottom);
	});

	it('should adjust plotTop for top legend', () => {
		const style: PptxChartStyle = { hasLegend: true };
		const layout = computeLayout(800, 600, style, false, 't');
		const noLegend = computeLayout(800, 600, undefined, false, 't');
		expect(layout.plotTop).toBeGreaterThan(noLegend.plotTop);
	});

	it('should adjust plotRight for right legend', () => {
		const style: PptxChartStyle = { hasLegend: true };
		const layout = computeLayout(800, 600, style, false, 'r');
		const noLegend = computeLayout(800, 600, undefined, false, 'r');
		expect(layout.plotRight).toBeLessThan(noLegend.plotRight);
	});

	it('should adjust plotLeft for left legend', () => {
		const style: PptxChartStyle = { hasLegend: true };
		const layout = computeLayout(800, 600, style, false, 'l');
		const noLegend = computeLayout(800, 600, undefined, false, 'l');
		expect(layout.plotLeft).toBeGreaterThan(noLegend.plotLeft);
	});

	it('should ensure plotWidth and plotHeight are at least 1', () => {
		// Use very small dimensions to push boundaries
		const layout = computeLayout(1, 1, undefined, true, 'b');
		expect(layout.plotWidth).toBeGreaterThanOrEqual(1);
		expect(layout.plotHeight).toBeGreaterThanOrEqual(1);
	});

	it('should compute plotWidth and plotHeight correctly', () => {
		const layout = computeLayout(800, 600, undefined, false, 'b');
		expect(layout.plotWidth).toBe(layout.plotRight - layout.plotLeft);
		expect(layout.plotHeight).toBe(layout.plotBottom - layout.plotTop);
	});

	it('should combine title and legend adjustments', () => {
		const style: PptxChartStyle = { hasTitle: true, hasLegend: true };
		const layout = computeLayout(800, 600, style, true, 'b');
		// Title increases plotTop by 20, legend bottom reduces plotBottom by 20
		expect(layout.plotTop).toBeGreaterThanOrEqual(28); // 8 base + 20 title
	});
});
