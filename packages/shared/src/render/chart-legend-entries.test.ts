import type { PptxChartLegendEntry } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyLegendEntryOverrides } from './chart-legend-entries';
import type { LegendEntry } from './chart-view-model';

const legend: LegendEntry[] = [
	{ color: '#ff0000', label: 'Series A' },
	{ color: '#00ff00', label: 'Series B' },
	{ color: '#0000ff', label: 'Series C' },
];

describe('applyLegendEntryOverrides', () => {
	it('returns the same array reference when there are no overrides', () => {
		expect(applyLegendEntryOverrides(legend, undefined)).toBe(legend);
		expect(applyLegendEntryOverrides(legend, [])).toBe(legend);
	});

	it('drops a deleted entry entirely rather than hiding it', () => {
		const entries: PptxChartLegendEntry[] = [{ index: 1, deleted: true }];
		const result = applyLegendEntryOverrides(legend, entries);
		expect(result).toHaveLength(2);
		expect(result.map((e) => e.label)).toStrictEqual(['Series A', 'Series C']);
	});

	it('drops multiple deleted entries', () => {
		const entries: PptxChartLegendEntry[] = [
			{ index: 0, deleted: true },
			{ index: 2, deleted: true },
		];
		const result = applyLegendEntryOverrides(legend, entries);
		expect(result.map((e) => e.label)).toStrictEqual(['Series B']);
	});

	it('an explicit deleted:false override keeps the entry visible', () => {
		const entries: PptxChartLegendEntry[] = [{ index: 0, deleted: false }];
		const result = applyLegendEntryOverrides(legend, entries);
		expect(result).toHaveLength(3);
	});

	it('attaches a per-entry text-style override without affecting other entries', () => {
		const entries: PptxChartLegendEntry[] = [
			{ index: 1, textStyle: { bold: true, color: '#123456' } },
		];
		const result = applyLegendEntryOverrides(legend, entries);
		expect(result).toHaveLength(3);
		expect(result[0].textStyle).toBeUndefined();
		expect(result[1].textStyle).toStrictEqual({ bold: true, color: '#123456' });
		expect(result[2].textStyle).toBeUndefined();
	});

	it('combines deletion and text-style overrides across different entries', () => {
		const entries: PptxChartLegendEntry[] = [
			{ index: 0, deleted: true },
			{ index: 2, textStyle: { italic: true } },
		];
		const result = applyLegendEntryOverrides(legend, entries);
		expect(result.map((e) => e.label)).toStrictEqual(['Series B', 'Series C']);
		expect(result[1].textStyle).toStrictEqual({ italic: true });
	});

	it('ignores an override index that has no matching legend entry', () => {
		const entries: PptxChartLegendEntry[] = [{ index: 99, deleted: true }];
		expect(applyLegendEntryOverrides(legend, entries)).toHaveLength(3);
	});

	// Regression: a chart-level legend/chart-space `c:txPr` (e.g. an 18pt font)
	// used to be dropped entirely; only a per-entry `c:legendEntry/c:txPr`
	// override ever reached the rendered legend.
	describe('chart-level default text style (defaultTextStyle)', () => {
		it('returns the same array reference when neither kind of override is set', () => {
			expect(applyLegendEntryOverrides(legend, undefined, undefined)).toBe(legend);
		});

		it('applies the chart-level default to every entry when there are no per-entry overrides', () => {
			const result = applyLegendEntryOverrides(legend, undefined, { fontSize: 18 });
			expect(result.map((e) => e.textStyle)).toStrictEqual([
				{ fontSize: 18 },
				{ fontSize: 18 },
				{ fontSize: 18 },
			]);
		});

		it('lets a per-entry override win over the chart-level default', () => {
			const entries: PptxChartLegendEntry[] = [{ index: 1, textStyle: { fontSize: 24 } }];
			const result = applyLegendEntryOverrides(legend, entries, { fontSize: 18 });
			expect(result[0].textStyle).toStrictEqual({ fontSize: 18 });
			expect(result[1].textStyle).toStrictEqual({ fontSize: 24 });
			expect(result[2].textStyle).toStrictEqual({ fontSize: 18 });
		});

		it('still drops a deleted entry when a chart-level default is also set', () => {
			const entries: PptxChartLegendEntry[] = [{ index: 0, deleted: true }];
			const result = applyLegendEntryOverrides(legend, entries, { fontSize: 18 });
			expect(result.map((e) => e.label)).toStrictEqual(['Series B', 'Series C']);
			expect(result.every((e) => e.textStyle?.fontSize === 18)).toBeTruthy();
		});
	});
});
