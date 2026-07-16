import type { PptxChartAxisFormatting } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildCategoryAxisPlan } from './chart-category-axis';
import type { PlotLayout } from './chart-view-model';

const layout: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 40,
	plotRight: 360,
	plotTop: 30,
	plotBottom: 260,
	plotWidth: 320,
	plotHeight: 230,
};

function axis(overrides: Partial<PptxChartAxisFormatting>): PptxChartAxisFormatting {
	return { axisType: 'catAx', axPos: 'b', ...overrides };
}

describe('category axis plan', () => {
	it('reverses display order and applies label skip without losing source indexes', () => {
		const plan = buildCategoryAxisPlan(['A', 'B', 'C', 'D'], layout, 'bar', [
			axis({ orientation: 'maxMin', tickLabelSkip: 2 }),
		]);
		expect(plan.sourceIndices).toStrictEqual([3, 2, 1, 0]);
		expect(plan.labels.map((label) => label.text)).toStrictEqual(['D', 'B']);
	});

	it('honors label position, offset, alignment, and hidden labels', () => {
		const high = buildCategoryAxisPlan(['A'], layout, 'line', [
			axis({ tickLblPos: 'high', labelOffset: 200, labelAlignment: 'l' }),
		]);
		expect(high.labels[0].y).toBeLessThan(layout.plotTop);
		expect(high.labels[0].textAnchor).toBe('start');
		expect(
			buildCategoryAxisPlan(['A'], layout, 'line', [axis({ tickLblPos: 'none' })]).labels,
		).toHaveLength(0);
	});

	it('emits configured major and minor category tick marks using tickMarkSkip', () => {
		const plan = buildCategoryAxisPlan(['A', 'B', 'C', 'D'], layout, 'bar', [
			axis({ majorTickMark: 'out', minorTickMark: 'in', tickMarkSkip: 2 }),
		]);
		expect(plan.tickMarks).toHaveLength(3);
		expect(plan.tickMarks.filter((tick) => tick.y2 > tick.y1)).toHaveLength(2);
		expect(plan.tickMarks.filter((tick) => tick.y2 < tick.y1)).toHaveLength(1);
	});
});
