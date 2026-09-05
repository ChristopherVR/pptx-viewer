/**
 * chart-cx-axis-units.ts: value-axis display-units support (classic
 * `c:dispUnits`, ChartEx `cx:units`, C1 gap) for the chart-type renderers
 * that build their own axis chrome with `buildGridlinesAndLabels`
 * (histogram/pareto, waterfall, box-whisker) rather than the richer
 * cartesian `buildPrimaryAxis` pipeline (`chart-cartesian-axes.ts`, used by
 * classic bar/line/area/scatter charts).
 *
 * Those renderers never consulted ANY axis formatting before this module:
 * they render the same for a chart with or without `c:dispUnits`/`cx:units`.
 * `buildValueAxisGridlinesAndLabels` is a drop-in replacement for
 * `buildGridlinesAndLabels` that adds unit-scaled tick text plus the rotated
 * caption when the chart's value axis declares one, reusing the exact
 * divisor/caption helpers `buildPrimaryAxis` already uses for classic
 * cartesian charts (`chart-axis.ts`'s `formatAxisValueWithUnits`/
 * `getDisplayUnitLabel`) so a ChartEx axis renders identically to a classic
 * one once its `cx:units` parses into the same `displayUnits`/
 * `displayUnitsValue`/`displayUnitsLabel` fields (see
 * `chart-cx-axis-parser.ts`). Falls back to the base builder's output
 * unchanged when the axis declares no display units, so an untouched chart
 * renders byte-identical.
 *
 * @module chart-cx-axis-units
 */
import type { PptxChartAxisFormatting } from 'pptx-viewer-core';

import { formatAxisValueWithUnits, getDisplayUnitLabel } from './chart-axis';
import { chartAxisTextStyle, unitsLabelTextStyle } from './chart-axis-style';
import type { PlotLayout, SvgLine, SvgText, ValueRange } from './chart-view-model';
import { axisTickValues, buildGridlinesAndLabels } from './chart-view-model';

/** Find a chart's value axis among its parsed `c:catAx`/`c:valAx`/`cx:axis` entries. */
export function findValueAxis(
	axes: readonly PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
	return axes?.find((axis) => axis.axisType === 'valAx');
}

/**
 * `buildGridlinesAndLabels`, but with tick text scaled by the value axis's
 * display units and a rotated unit caption appended, when `axis` declares
 * one (`axis?.displayUnits` truthy). `range` and `layout` are forwarded to
 * the base builder unchanged.
 */
export function buildValueAxisGridlinesAndLabels(
	range: ValueRange,
	layout: PlotLayout,
	axis: PptxChartAxisFormatting | undefined,
	showMajorGridlines = true,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const base = buildGridlinesAndLabels(range, layout, showMajorGridlines);
	if (!axis?.displayUnits) {
		return base;
	}
	const ticks = axisTickValues(range);
	const axisLabels = base.axisLabels.map((label, index) => {
		const val = ticks[index];
		return val === undefined ? label : { ...label, text: formatAxisValueWithUnits(val, axis) };
	});
	const unitLabel = getDisplayUnitLabel(axis.displayUnits, axis.displayUnitsLabel);
	if (unitLabel) {
		const labelX = layout.plotLeft - 36;
		const midY = (layout.plotTop + layout.plotBottom) / 2;
		axisLabels.push({
			kind: 'text',
			x: labelX,
			y: midY,
			text: unitLabel,
			...unitsLabelTextStyle(axis, chartAxisTextStyle(axis)),
			textAnchor: 'middle',
			transform: `rotate(-90, ${labelX}, ${midY})`,
		});
	}
	return { gridlines: base.gridlines, axisLabels };
}
