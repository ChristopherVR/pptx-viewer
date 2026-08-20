/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own short arrange/act/assert consts. */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createChartDataGrid } from './chart-data-grid';

/**
 * chart-data-grid highlight (vanilla): the on-canvas chart part selection
 * surfaced into the inspector's spreadsheet grid, mirroring Vue's
 * `ChartDataGrid` `highlightCell` prop. Before this landed the grid had no
 * way to reflect a canvas click at all.
 */
function chart(): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B', 'C'],
		series: [
			{ name: 'S1', values: [1, 2, 3] },
			{ name: 'S2', values: [4, 5, 6] },
		],
	};
}

function mount() {
	const onChange = vi.fn();
	const grid = createChartDataGrid(document, (key) => key, onChange);
	document.body.appendChild(grid.el);
	return { grid, onChange };
}

describe('chart data grid highlight', () => {
	it('carries no highlight class when nothing is selected', () => {
		const { grid } = mount();
		grid.update(chart());

		expect(grid.el.querySelector('.pptxv-chart-grid-cell-highlight')).toBeNull();
	});

	it('rings the value cell matching a pointIndex selection', () => {
		const { grid } = mount();
		grid.update(chart(), { seriesIndex: 1, pointIndex: 2 });

		const values = Array.from(grid.el.querySelectorAll('tbody input[type="number"]'));
		const highlighted = values.filter((input) =>
			input.classList.contains('pptxv-chart-grid-cell-highlight'),
		);
		expect(highlighted).toHaveLength(1);
		// Series 1 ("S2"), category 2 ("C") -> value 6.
		expect((highlighted[0] as HTMLInputElement).value).toBe('6');
	});

	it('rings the series-name header for a series-only selection (no pointIndex)', () => {
		const { grid } = mount();
		grid.update(chart(), { seriesIndex: 0 });

		const names = Array.from(grid.el.querySelectorAll('thead input[type="text"]'));
		const highlighted = names.filter((input) =>
			input.classList.contains('pptxv-chart-grid-cell-highlight'),
		);
		expect(highlighted).toHaveLength(1);
		expect((highlighted[0] as HTMLInputElement).value).toBe('S1');
	});

	it('scrolls the newly-highlighted cell into view exactly once per selection change', () => {
		const { grid } = mount();
		const scrollIntoView = vi.fn();
		// jsdom does not implement scrollIntoView; stub it on the prototype so the
		// grid's call resolves to something observable.
		HTMLElement.prototype.scrollIntoView = scrollIntoView;

		grid.update(chart(), { seriesIndex: 0, pointIndex: 1 });
		expect(scrollIntoView).toHaveBeenCalledOnce();

		// An unrelated re-render with the SAME selection must not re-scroll.
		grid.update(chart(), { seriesIndex: 0, pointIndex: 1 });
		expect(scrollIntoView).toHaveBeenCalledOnce();

		// A genuinely different selection scrolls again.
		grid.update(chart(), { seriesIndex: 1, pointIndex: 1 });
		expect(scrollIntoView).toHaveBeenCalledTimes(2);
	});
});
