import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartViewModel } from './chart-view-model-build';

/** Three thin adjacent slices whose outside bestFit labels would overlap. */
const element = {
	id: 'pie',
	type: 'chart',
	x: 0,
	y: 0,
	width: 400,
	height: 400,
	chartData: {
		chartType: 'pie',
		chartChrome: { autoTitleDeleted: true },
		categories: ['A', 'B', 'C', 'D', 'E'],
		series: [
			{
				name: 'S',
				values: [50, 1, 1, 1, 47],
				dataLabelOptions: { position: 'bestFit', showLeaderLines: true },
			},
		],
		style: { hasDataLabels: true },
	},
} as unknown as PptxElement;

describe('pie bestFit outside label collisions', () => {
	it('nudges overlapping outside labels apart and draws leader lines to them', () => {
		const vm = buildChartViewModel(element);
		const thin = vm.dataLabels.filter((l) => l.text === '1');
		expect(thin).toHaveLength(3);
		const ys = thin.map((l) => l.y).sort((a, b) => a - b);
		for (let i = 1; i < ys.length; i++) {
			expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(thin[0]!.fontSize);
		}
		const leaders = vm.primitives.filter((p) => p.kind === 'line');
		expect(leaders.length).toBeGreaterThanOrEqual(2);
	});
});
