import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	DATA_TABLE_HEADER_H,
	DATA_TABLE_KEY_W,
	DATA_TABLE_ROW_H,
	computeDataTablePrimitives,
} from './chart-data-table-render';
import type { PlotLayout, SvgText } from './chart-view-model';

const LAYOUT: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 48,
	plotTop: 20,
	plotRight: 392,
	plotBottom: 276,
	plotWidth: 344,
	plotHeight: 256,
};

function makeChartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'line',
		categories: ['A', 'B', 'C', 'D'],
		series: [],
		...overrides,
	};
}

function makeSeries(overrides: Partial<PptxChartSeries> = {}): PptxChartSeries {
	return {
		name: 'Series 1',
		values: [10, 20, 30, 40],
		...overrides,
	};
}

function texts(result: ReturnType<typeof computeDataTablePrimitives>): SvgText[] {
	return result.filter((p): p is SvgText => p.kind === 'text');
}

describe('computeDataTablePrimitives', () => {
	it('returns empty array when dataTable is absent', () => {
		const chartData = makeChartData({ series: [makeSeries()] });
		expect(computeDataTablePrimitives(chartData, LAYOUT)).toHaveLength(0);
	});

	it('returns empty array when dataTable present but no categories and no series', () => {
		const chartData = makeChartData({
			categories: [],
			series: [],
			dataTable: {},
		});
		expect(computeDataTablePrimitives(chartData, LAYOUT)).toHaveLength(0);
	});

	it('returns primitives when dataTable is present with data', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { showHorzBorder: true, showVertBorder: true, showOutline: true, showKeys: true },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		expect(result.length).toBeGreaterThan(0);
	});

	it('produces category header text labels', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: {},
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const values = texts(result).map((p) => p.text);
		expect(values).toContain('A');
		expect(values).toContain('B');
		expect(values).toContain('C');
		expect(values).toContain('D');
	});

	it('produces series name text when showKeys is true', () => {
		const chartData = makeChartData({
			series: [makeSeries({ name: 'Revenue' })],
			dataTable: { showKeys: true },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		expect(texts(result).map((p) => p.text)).toContain('Revenue');
	});

	it('does not include series name when showKeys is false', () => {
		const chartData = makeChartData({
			series: [makeSeries({ name: 'Revenue' })],
			dataTable: { showKeys: false },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		expect(texts(result).map((p) => p.text)).not.toContain('Revenue');
	});

	it('places table below plotBottom', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: {},
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const allY = result
			.flatMap((p) => {
				if (p.kind === 'line') {
					return [p.y1, p.y2];
				}
				if (p.kind === 'text') {
					return [p.y];
				}
				if (p.kind === 'rect') {
					return [p.y];
				}
				return [];
			})
			.filter((y) => y > 0);
		expect(allY.every((y) => y >= LAYOUT.plotBottom)).toBeTruthy();
	});

	it('produces outline border lines when showOutline is true', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { showOutline: true },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const lines = result.filter((p) => p.kind === 'line');
		// At minimum 4 border lines for the outline
		expect(lines.length).toBeGreaterThanOrEqual(4);
	});

	it('produces no outline when showOutline is false', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { showOutline: false, showHorzBorder: false, showVertBorder: false },
		});
		// No border lines at all; only category text + value text + swatch rects
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const lines = result.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(0);
	});

	it('exports DATA_TABLE_ROW_H, DATA_TABLE_HEADER_H, DATA_TABLE_KEY_W as positive numbers', () => {
		expect(DATA_TABLE_ROW_H).toBeGreaterThan(0);
		expect(DATA_TABLE_HEADER_H).toBeGreaterThan(0);
		expect(DATA_TABLE_KEY_W).toBeGreaterThan(0);
	});

	it('does not crash with multiple series', () => {
		const chartData = makeChartData({
			series: [makeSeries({ name: 'S1' }), makeSeries({ name: 'S2', values: [5, 15, 25, 35] })],
			dataTable: { showKeys: true },
		});
		expect(() => computeDataTablePrimitives(chartData, LAYOUT)).not.toThrow();
	});

	// ───────────────────────────────────────────────────────────────────────
	// c:dTable/c:spPr + c:txPr honouring
	// ───────────────────────────────────────────────────────────────────────

	it('uses default border/text colours and 8px cell text when spPr/txPr are absent', () => {
		const chartData = makeChartData({ series: [makeSeries()], dataTable: { showOutline: true } });
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const line = result.find((p) => p.kind === 'line');
		const label = texts(result)[0];
		expect(line && 'stroke' in line ? line.stroke : undefined).toBe('#cbd5e1');
		expect(label.fill).toBe('#334155');
		expect(label.fontSize).toBe(8);
		expect(label.fontFamily).toBeUndefined();
	});

	it('honours spPr strokeColor/strokeWidth for every border line', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: {
				showOutline: true,
				showHorzBorder: true,
				showVertBorder: true,
				showKeys: true,
				spPr: { strokeColor: '#ff00ff', strokeWidth: 2 },
			},
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const lines = result.filter((p) => p.kind === 'line');
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			expect(line.stroke).toBe('#ff00ff');
			expect(line.strokeWidth).toBe(2);
		}
	});

	it('paints a background rect from spPr.fillColor behind the table', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { spPr: { fillColor: '#fefce8' } },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const bg = result.find((p) => p.kind === 'rect' && p.fill === '#fefce8');
		expect(bg).toBeDefined();
		// The background rect is emitted first so every border/text primitive layers on top.
		expect(result[0]).toBe(bg);
	});

	it('does not paint a background rect when spPr has no fillColor', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { spPr: { strokeColor: '#000000' } },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		expect(result.some((p) => p.kind === 'rect' && p.fill !== undefined && p.h > 8)).toBeFalsy();
	});

	it('honours txPr colour/fontFamily/fontSize on header, key, and cell text', () => {
		const chartData = makeChartData({
			series: [makeSeries({ name: 'Revenue' })],
			dataTable: {
				showKeys: true,
				txPr: { color: '#123456', fontFamily: 'Georgia', fontSize: 12 },
			},
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		for (const label of texts(result)) {
			expect(label.fill).toBe('#123456');
			expect(label.fontFamily).toBe('Georgia');
			expect(label.fontSize).toBeCloseTo(16); // 12pt * 4/3
		}
	});

	it('applies txPr.bold uniformly to header and data cells when explicitly set', () => {
		const chartData = makeChartData({
			series: [makeSeries({ name: 'Revenue' })],
			dataTable: { showKeys: true, txPr: { bold: true } },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		expect(texts(result).every((label) => label.fontWeight === 'bold')).toBeTruthy();
	});

	it('applies txPr.bold:false to un-bold even the header row', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { txPr: { bold: false } },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		expect(texts(result).every((label) => label.fontWeight === 'normal')).toBeTruthy();
	});

	it('defaults the header row to bold and data rows to normal when txPr.bold is unset', () => {
		const chartData = makeChartData({
			series: [makeSeries({ name: 'Revenue' })],
			dataTable: { showKeys: true },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const header = texts(result).find((label) => label.text === 'A');
		const cell = texts(result).find((label) => label.text === 'Revenue');
		expect(header?.fontWeight).toBe('bold');
		expect(cell?.fontWeight).toBe('normal');
	});

	it('honours txPr.italic', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { txPr: { italic: true } },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		expect(texts(result).every((label) => label.fontStyle === 'italic')).toBeTruthy();
	});
});
