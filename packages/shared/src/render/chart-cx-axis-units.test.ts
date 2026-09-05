/**
 * Tests for `buildValueAxisGridlinesAndLabels` (C1 gap): histogram/waterfall/
 * box-whisker previously never consulted axis display units at all, unlike
 * classic cartesian charts' `buildPrimaryAxis`.
 */
import type { PptxChartAxisFormatting } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildValueAxisGridlinesAndLabels, findValueAxis } from './chart-cx-axis-units';
import type { PlotLayout, ValueRange } from './chart-view-model';
import { buildGridlinesAndLabels } from './chart-view-model';

const layout: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 48,
	plotTop: 8,
	plotRight: 392,
	plotBottom: 276,
	plotWidth: 344,
	plotHeight: 268,
};
const range: ValueRange = { min: 0, max: 5000, span: 5000 };

describe('findValueAxis', () => {
	it('returns undefined when no axes were parsed', () => {
		expect(findValueAxis(undefined)).toBeUndefined();
	});

	it('picks the axisType "valAx" entry regardless of position in the list', () => {
		const catAx: PptxChartAxisFormatting = { axisType: 'catAx' };
		const valAx: PptxChartAxisFormatting = { axisType: 'valAx' };
		expect(findValueAxis([catAx, valAx])).toBe(valAx);
	});
});

describe('buildValueAxisGridlinesAndLabels', () => {
	it('matches buildGridlinesAndLabels exactly when the axis has no display units', () => {
		const legacy = buildGridlinesAndLabels(range, layout);
		const fresh = buildValueAxisGridlinesAndLabels(range, layout, { axisType: 'valAx' });
		expect(fresh.gridlines).toStrictEqual(legacy.gridlines);
		expect(fresh.axisLabels).toStrictEqual(legacy.axisLabels);
	});

	it('matches buildGridlinesAndLabels exactly when no axis is given (undefined)', () => {
		const legacy = buildGridlinesAndLabels(range, layout);
		const fresh = buildValueAxisGridlinesAndLabels(range, layout, undefined);
		expect(fresh).toStrictEqual(legacy);
	});

	it('scales tick text by a classic c:dispUnits builtInUnit and appends the caption', () => {
		const axis: PptxChartAxisFormatting = { axisType: 'valAx', displayUnits: 'thousands' };
		const result = buildValueAxisGridlinesAndLabels(range, layout, axis);
		// 5000 thousands-scaled -> "5"; the raw axisTickValues top value is 5000.
		expect(result.axisLabels.some((label) => label.text === '5')).toBeTruthy();
		// Caption appended as one extra rotated label beyond the tick labels.
		const legacy = buildGridlinesAndLabels(range, layout);
		expect(result.axisLabels).toHaveLength(legacy.axisLabels.length + 1);
		expect(result.axisLabels.at(-1)?.text).toBe('Thousands');
	});

	it('scales tick text by a ChartEx cx:units custom divisor (C1 cx:units gap)', () => {
		const axis: PptxChartAxisFormatting = {
			axisType: 'valAx',
			displayUnits: 'custom',
			displayUnitsValue: 1000,
			displayUnitsLabel: { text: 'K units', fontBold: true, fontColor: '#ff0000' },
		};
		const result = buildValueAxisGridlinesAndLabels(range, layout, axis);
		expect(result.axisLabels.some((label) => label.text === '5')).toBeTruthy();
		const caption = result.axisLabels.at(-1);
		expect(caption?.text).toBe('K units');
		expect(caption?.fontWeight).toBe('bold');
		expect(caption?.fill).toBe('#ff0000');
	});

	it('omits the caption when displayUnits is set but no label text resolves', () => {
		const axis: PptxChartAxisFormatting = {
			axisType: 'valAx',
			displayUnits: 'custom',
			displayUnitsValue: 1000,
		};
		const legacy = buildGridlinesAndLabels(range, layout);
		const result = buildValueAxisGridlinesAndLabels(range, layout, axis);
		expect(result.axisLabels).toHaveLength(legacy.axisLabels.length);
	});

	it('forwards showMajorGridlines through to the base builder', () => {
		const result = buildValueAxisGridlinesAndLabels(range, layout, undefined, false);
		expect(result.gridlines).toHaveLength(0);
	});
});
