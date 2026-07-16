import type { PptxChartSeries } from 'pptx-viewer-core';

import { buildSecondaryAxis } from './chart-axis-render';
import type { PlotLayout, SvgCircle, SvgPolyline, SvgPrimitive, SvgText } from './chart-view-model';

export interface ParetoEntry {
	value: number;
	label: string;
	sourcePointIndex: number;
}

/** Sort by descending non-negative frequency while retaining stable source mapping. */
export function orderParetoEntries(entries: ReadonlyArray<ParetoEntry>): ParetoEntry[] {
	return [...entries].sort(
		(left, right) =>
			Math.max(right.value, 0) - Math.max(left.value, 0) ||
			left.sourcePointIndex - right.sourcePointIndex,
	);
}

/** Build cumulative percentage line marks in Pareto display order. */
export function buildParetoPrimitives(
	entries: ReadonlyArray<ParetoEntry>,
	layout: PlotLayout,
	series: PptxChartSeries,
	seriesIndex: number,
): SvgPrimitive[] {
	const total = entries.reduce((sum, entry) => sum + Math.max(entry.value, 0), 0);
	if (total <= 0) {
		return [];
	}
	let cumulative = 0;
	const points = entries.map((entry, displayIndex) => {
		cumulative += Math.max(entry.value, 0);
		const percentage = displayIndex === entries.length - 1 ? 100 : (cumulative / total) * 100;
		return {
			x: layout.plotLeft + (layout.plotWidth * (displayIndex + 0.5)) / entries.length,
			y: layout.plotBottom - (layout.plotHeight * percentage) / 100,
			pointIndex: entry.sourcePointIndex,
		};
	});
	const color = series.color ?? '#ED7D31';
	return [
		{
			kind: 'polyline',
			points: points.map((point) => `${point.x},${point.y}`).join(' '),
			stroke: color,
			strokeWidth: 2,
			fill: 'none',
			part: { role: 'series', seriesIndex },
		} satisfies SvgPolyline,
		...points.map(
			(point) =>
				({
					kind: 'circle',
					cx: point.x,
					cy: point.y,
					r: 2.5,
					fill: color,
					part: { role: 'dataPoint', seriesIndex, pointIndex: point.pointIndex },
				}) satisfies SvgCircle,
		),
	];
}

/** Build the fixed Pareto percentage axis using shared secondary-axis conventions. */
export function buildParetoAxis(layout: PlotLayout): {
	secondaryGridlines: ReturnType<typeof buildSecondaryAxis>['gridlines'];
	secondaryAxisLabels: SvgText[];
} {
	const axis = buildSecondaryAxis({ min: 0, max: 100, span: 100 }, layout, {
		axisType: 'valAx',
		axPos: 'r',
		majorUnit: 20,
		majorTickMark: 'out',
	});
	return {
		secondaryGridlines: axis.gridlines,
		secondaryAxisLabels: axis.axisLabels.map((label) => ({
			...label,
			text: `${label.text}%`,
		})),
	};
}
