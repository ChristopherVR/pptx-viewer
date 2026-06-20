/**
 * chart-axis-render.ts: value-axis gridline + label primitive builders that
 * honour the richer cartesian axis features (log scale, display units, and a
 * secondary right-side value axis).
 *
 * These complement the linear single-axis `buildGridlinesAndLabels` in
 * `chart-view-model.ts`. They are pure and reuse the existing axis maths in
 * `chart-axis.ts` (`generateLogTicks`, `formatAxisValueWithUnits`,
 * `getDisplayUnitLabel`) and the shared `valueToY` / `formatAxisValue`.
 *
 * @module chart-axis-render
 */
import type { PptxChartAxisFormatting } from 'pptx-viewer-core';

import { formatAxisValueWithUnits, generateLogTicks, getDisplayUnitLabel } from './chart-axis';
import type { PlotLayout, SvgLine, SvgText, ValueRange } from './chart-view-model';
import { formatAxisValue, valueToY } from './chart-view-model';

const GRIDLINE_COLOR = '#e2e8f0';
const AXIS_LABEL_COLOR = '#64748b';
const SECONDARY_GRID_COLOR = '#e2e8f0';
const TICK_COUNT = 5;

/** Format a value-axis tick: display-unit scaled when the axis declares units. */
function formatTick(val: number, axis: PptxChartAxisFormatting | undefined): string {
	if (axis?.displayUnits) {
		return formatAxisValueWithUnits(val, axis);
	}
	return formatAxisValue(val);
}

/**
 * Build primary value-axis gridlines + left-side labels, honouring log scale and
 * display units. When neither is active the output is identical (same tick count,
 * coordinates, and label text) to `buildGridlinesAndLabels`, so the linear default
 * path is unchanged.
 */
export function buildPrimaryAxis(
	range: ValueRange,
	layout: PlotLayout,
	axis: PptxChartAxisFormatting | undefined,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const gridlines: SvgLine[] = [];
	const axisLabels: SvgText[] = [];

	const tickVals =
		range.logScale && range.logBase
			? generateLogTicks(range)
			: Array.from({ length: TICK_COUNT + 1 }, (_, i) => range.min + (range.span / TICK_COUNT) * i);

	for (const val of tickVals) {
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
		gridlines.push({
			kind: 'line',
			x1: layout.plotLeft,
			y1: y,
			x2: layout.plotRight,
			y2: y,
			stroke: GRIDLINE_COLOR,
			strokeWidth: 1,
		});
		axisLabels.push({
			kind: 'text',
			x: layout.plotLeft - 4,
			y,
			text: formatTick(val, axis),
			fontSize: 8,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'end',
			dominantBaseline: 'central',
		});
	}

	// Display-units caption (e.g. "Thousands"), rotated alongside the left axis.
	if (axis?.displayUnits) {
		const unitLabel = getDisplayUnitLabel(axis.displayUnits, axis.displayUnitsLabel);
		if (unitLabel) {
			const labelX = layout.plotLeft - 36;
			const midY = (layout.plotTop + layout.plotBottom) / 2;
			axisLabels.push({
				kind: 'text',
				x: labelX,
				y: midY,
				text: unitLabel,
				fontSize: 9,
				fill: AXIS_LABEL_COLOR,
				textAnchor: 'middle',
				transform: `rotate(-90, ${labelX}, ${midY})`,
			});
		}
	}

	return { gridlines, axisLabels };
}

/**
 * Build secondary (right-side) value-axis gridlines + labels. Always linear
 * (PowerPoint secondary value axes are not log-scaled here). Labels sit just to
 * the right of `plotRight`; gridlines span the plot like the primary ones but in
 * a lighter dashed-style colour so projectors can distinguish them.
 */
export function buildSecondaryAxis(
	range: ValueRange,
	layout: PlotLayout,
	axis: PptxChartAxisFormatting | undefined,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const gridlines: SvgLine[] = [];
	const axisLabels: SvgText[] = [];
	const fontSize = axis?.fontSize ?? 8;
	const fontColor = axis?.fontColor ?? AXIS_LABEL_COLOR;
	const fontWeight: 'normal' | 'bold' = axis?.fontBold ? 'bold' : 'normal';

	for (let i = 0; i <= TICK_COUNT - 1; i++) {
		const val = range.min + (range.span / (TICK_COUNT - 1)) * i;
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
		gridlines.push({
			kind: 'line',
			x1: layout.plotLeft,
			y1: y,
			x2: layout.plotRight,
			y2: y,
			stroke: SECONDARY_GRID_COLOR,
			strokeWidth: 0.5,
			dashArray: '2 3',
			opacity: 0.5,
		});
		axisLabels.push({
			kind: 'text',
			x: layout.plotRight + 4,
			y,
			text: formatTick(val, axis),
			fontSize,
			fill: fontColor,
			textAnchor: 'start',
			fontWeight,
			dominantBaseline: 'central',
		});
	}

	// Secondary axis title (rotated +90 on the right).
	if (axis?.titleText) {
		const titleX = layout.plotRight + 36;
		const midY = (layout.plotTop + layout.plotBottom) / 2;
		axisLabels.push({
			kind: 'text',
			x: titleX,
			y: midY,
			text: axis.titleText,
			fontSize: 9,
			fill: fontColor,
			textAnchor: 'middle',
			transform: `rotate(-90, ${titleX}, ${midY})`,
		});
	}

	// Secondary display-units caption.
	if (axis?.displayUnits) {
		const unitLabel = getDisplayUnitLabel(axis.displayUnits, axis.displayUnitsLabel);
		if (unitLabel) {
			const labelX = layout.plotRight + (axis.titleText ? 52 : 36);
			const midY = (layout.plotTop + layout.plotBottom) / 2;
			axisLabels.push({
				kind: 'text',
				x: labelX,
				y: midY,
				text: unitLabel,
				fontSize: 9,
				fill: fontColor,
				textAnchor: 'middle',
				transform: `rotate(-90, ${labelX}, ${midY})`,
			});
		}
	}

	return { gridlines, axisLabels };
}
