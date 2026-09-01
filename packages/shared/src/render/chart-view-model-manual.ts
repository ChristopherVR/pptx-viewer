/**
 * chart-view-model-manual.ts: the `c:manualLayout` post-pass for the chart
 * title and legend.
 *
 * The plot area's manual layout is honoured where the plot rect is computed
 * (`computePlotLayout`, `computePieLayout`), which every kind's builder goes
 * through. Title and legend anchors, however, are stamped by each builder
 * (cartesian, combo, pie, radar, surface, ...) from its own defaults, so the
 * manual placement is applied once here, after the builder has produced its
 * automatic anchor: that automatic anchor is what a `factor`-mode offset is
 * relative to.
 *
 * @module chart-view-model-manual
 */

import type { PptxChartData } from 'pptx-viewer-core';

import {
	chartFrameToViewOffset,
	manualLayoutOf,
	manualLegendAnchor,
	manualTitleAnchor,
} from './chart-manual-layout';
import type { ChartFrameSize } from './chart-manual-layout';
import type { ChartViewModel } from './chart-view-model-types';

/**
 * Re-anchor a finished view-model's title and legend from
 * `chartData.layouts`. Returns the view-model unchanged when the chart
 * declares no manual title / legend layout, or the region is not shown.
 *
 * @param frame - The chart element's box; manual layouts are fractions of it.
 */
export function withManualLayouts(
	vm: ChartViewModel,
	chartData: Pick<PptxChartData, 'layouts'>,
	frame: ChartFrameSize,
): ChartViewModel {
	const titleLayout = manualLayoutOf(chartData, 'title'),
		legendLayout = manualLayoutOf(chartData, 'legend');
	if (!titleLayout && !legendLayout) {
		return vm;
	}
	// Manual layouts are measured on the element; a letterboxed (pie) view-model
	// lives in a centred square, so translate the automatic anchor out to the
	// element, resolve, and translate the result back in.
	const offset = chartFrameToViewOffset(frame, vm);
	let next = vm;

	if (titleLayout && vm.title !== undefined) {
		const anchor = manualTitleAnchor(titleLayout, frame, vm.title, {
			x: vm.titleX + offset.x,
			y: vm.titleY + offset.y,
		});
		if (anchor) {
			next = { ...next, titleX: anchor.x - offset.x, titleY: anchor.y - offset.y };
		}
	}

	if (legendLayout && vm.legend.length > 0) {
		const anchor = manualLegendAnchor(
			legendLayout,
			frame,
			vm.legend.length,
			vm.legendAnchor === 'start',
			{ x: vm.legendX + offset.x, y: vm.legendY + offset.y },
		);
		if (anchor) {
			next = { ...next, legendX: anchor.x - offset.x, legendY: anchor.y - offset.y };
		}
	}

	return next;
}
