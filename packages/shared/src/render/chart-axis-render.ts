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

import {
	formatAxisValueWithUnits,
	generateAxisTicks,
	generateMinorAxisTicks,
	getDisplayUnitLabel,
} from './chart-axis';
import type { PlotLayout, SvgLine, SvgText, ValueRange } from './chart-view-model';
import { formatAxisValue, valueToY } from './chart-view-model';

const GRIDLINE_COLOR = '#e2e8f0';
const AXIS_LABEL_COLOR = '#64748b';
const SECONDARY_GRID_COLOR = '#e2e8f0';
const TICK_COUNT = 5;
const MAJOR_TICK_LENGTH = 4;
const MINOR_TICK_LENGTH = 2.5;

type VerticalAxisSide = 'left' | 'right';

/** Build one explicit ChartML tick-mark line on a vertical value axis. */
function buildTickMark(
	axisX: number,
	y: number,
	placement: PptxChartAxisFormatting['majorTickMark'],
	side: VerticalAxisSide,
	length: number,
): SvgLine | undefined {
	if (!placement || placement === 'none') {
		return undefined;
	}
	const inward = side === 'left' ? 1 : -1;
	const startOffset = placement === 'cross' ? -inward * length : 0;
	const endOffset = placement === 'out' ? -inward * length : inward * length;
	return {
		kind: 'line',
		x1: axisX + startOffset,
		y1: y,
		x2: axisX + endOffset,
		y2: y,
		stroke: AXIS_LABEL_COLOR,
		strokeWidth: 1,
	};
}

/** Resolve label placement at the low or high side of a vertical chart axis. */
function valueAxisLabelPlacement(
	layout: PlotLayout,
	position: PptxChartAxisFormatting['tickLblPos'],
	defaultSide: VerticalAxisSide,
	axisX: number,
): Pick<SvgText, 'x' | 'textAnchor'> {
	if (!position || position === 'nextTo') {
		return defaultSide === 'left'
			? { x: axisX - 4, textAnchor: 'end' }
			: { x: axisX + 4, textAnchor: 'start' };
	}
	const side = position === 'high' ? 'right' : position === 'low' ? 'left' : defaultSide;
	return side === 'left'
		? { x: layout.plotLeft - 4, textAnchor: 'end' }
		: { x: layout.plotRight + 4, textAnchor: 'start' };
}

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
	axisX = layout.plotLeft,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const gridlines: SvgLine[] = [];
	const axisLabels: SvgText[] = [];

	const tickVals = generateAxisTicks(range, axis, TICK_COUNT);
	const minorTickVals = generateMinorAxisTicks(range, axis);
	if (axis?.minorGridlines) {
		for (const val of minorTickVals) {
			const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
			gridlines.push({
				kind: 'line',
				x1: layout.plotLeft,
				y1: y,
				x2: layout.plotRight,
				y2: y,
				stroke: GRIDLINE_COLOR,
				strokeWidth: 0.5,
				dashArray: '1 2',
				opacity: 0.5,
			});
		}
	}
	for (const val of minorTickVals) {
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
		const tick = buildTickMark(axisX, y, axis?.minorTickMark, 'left', MINOR_TICK_LENGTH);
		if (tick) {
			gridlines.push(tick);
		}
	}

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
		const tick = buildTickMark(axisX, y, axis?.majorTickMark, 'left', MAJOR_TICK_LENGTH);
		if (tick) {
			gridlines.push(tick);
		}
		if (axis?.tickLblPos !== 'none') {
			axisLabels.push({
				kind: 'text',
				...valueAxisLabelPlacement(layout, axis?.tickLblPos, 'left', axisX),
				y,
				text: formatTick(val, axis),
				fontSize: 8,
				fill: AXIS_LABEL_COLOR,
				dominantBaseline: 'central',
			});
		}
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
 * Build secondary (right-side) value-axis gridlines + labels. Labels sit just
 * to the right of `plotRight`; gridlines span the plot like the primary ones
 * but in a lighter dashed style. Logarithmic ranges emit power-of-base ticks.
 */
export function buildSecondaryAxis(
	range: ValueRange,
	layout: PlotLayout,
	axis: PptxChartAxisFormatting | undefined,
	axisX = layout.plotRight,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const gridlines: SvgLine[] = [];
	const axisLabels: SvgText[] = [];
	const fontSize = axis?.fontSize ?? 8;
	const fontColor = axis?.fontColor ?? AXIS_LABEL_COLOR;
	const fontWeight: 'normal' | 'bold' = axis?.fontBold ? 'bold' : 'normal';

	const tickValues = generateAxisTicks(range, axis, TICK_COUNT - 1);
	const minorTickValues = generateMinorAxisTicks(range, axis);
	if (axis?.minorGridlines) {
		for (const val of minorTickValues) {
			const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
			gridlines.push({
				kind: 'line',
				x1: layout.plotLeft,
				y1: y,
				x2: layout.plotRight,
				y2: y,
				stroke: SECONDARY_GRID_COLOR,
				strokeWidth: 0.5,
				dashArray: '1 2',
				opacity: 0.35,
			});
		}
	}
	for (const val of minorTickValues) {
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
		const tick = buildTickMark(axisX, y, axis?.minorTickMark, 'right', MINOR_TICK_LENGTH);
		if (tick) {
			gridlines.push(tick);
		}
	}
	for (const val of tickValues) {
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
		const tick = buildTickMark(axisX, y, axis?.majorTickMark, 'right', MAJOR_TICK_LENGTH);
		if (tick) {
			gridlines.push(tick);
		}
		if (axis?.tickLblPos !== 'none') {
			axisLabels.push({
				kind: 'text',
				...valueAxisLabelPlacement(layout, axis?.tickLblPos, 'right', axisX),
				y,
				text: formatTick(val, axis),
				fontSize,
				fill: fontColor,
				fontWeight,
				dominantBaseline: 'central',
			});
		}
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
