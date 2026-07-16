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
import {
	buildStyledGridline,
	buildVerticalAxisLine,
	buildVerticalTickMark,
} from './chart-axis-primitives';
import { chartAxisTextStyle } from './chart-axis-style';
import type { PlotLayout, SvgLine, SvgText, ValueRange } from './chart-view-model';
import { formatAxisValue, valueToY } from './chart-view-model';

const GRIDLINE_COLOR = '#e2e8f0';
const SECONDARY_GRID_COLOR = '#e2e8f0';
const TICK_COUNT = 5;
const MAJOR_TICK_LENGTH = 4;
const MINOR_TICK_LENGTH = 2.5;

type VerticalAxisSide = 'left' | 'right';

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
	const axisLine = buildVerticalAxisLine(axis, axisX, layout);
	if (axisLine) {
		gridlines.push(axisLine);
	}
	if (axis?.minorGridlines) {
		for (const val of minorTickVals) {
			const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
			gridlines.push(
				buildStyledGridline(y, layout, axis.minorGridlinesSpPr, GRIDLINE_COLOR, 0.5, '1 2', 0.5),
			);
		}
	}
	for (const val of minorTickVals) {
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
		const tick = buildVerticalTickMark(
			axisX,
			y,
			axis?.minorTickMark,
			'left',
			MINOR_TICK_LENGTH,
			axis?.spPr,
		);
		if (tick) {
			gridlines.push(tick);
		}
	}

	for (const val of tickVals) {
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
		gridlines.push(
			buildStyledGridline(
				y,
				layout,
				axis?.majorGridlinesSpPr,
				GRIDLINE_COLOR,
				1,
				undefined,
				undefined,
			),
		);
		const tick = buildVerticalTickMark(
			axisX,
			y,
			axis?.majorTickMark,
			'left',
			MAJOR_TICK_LENGTH,
			axis?.spPr,
		);
		if (tick) {
			gridlines.push(tick);
		}
		if (axis?.tickLblPos !== 'none') {
			axisLabels.push({
				kind: 'text',
				...valueAxisLabelPlacement(layout, axis?.tickLblPos, 'left', axisX),
				y,
				text: formatTick(val, axis),
				...chartAxisTextStyle(axis),
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
				...chartAxisTextStyle(axis, 9),
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
	const textStyle = chartAxisTextStyle(axis);
	const captionStyle = chartAxisTextStyle(axis, 9);
	const axisLine = buildVerticalAxisLine(axis, axisX, layout);
	if (axisLine) {
		gridlines.push(axisLine);
	}

	const tickValues = generateAxisTicks(range, axis, TICK_COUNT - 1);
	const minorTickValues = generateMinorAxisTicks(range, axis);
	if (axis?.minorGridlines) {
		for (const val of minorTickValues) {
			const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
			gridlines.push(
				buildStyledGridline(
					y,
					layout,
					axis.minorGridlinesSpPr,
					SECONDARY_GRID_COLOR,
					0.5,
					'1 2',
					0.35,
				),
			);
		}
	}
	for (const val of minorTickValues) {
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
		const tick = buildVerticalTickMark(
			axisX,
			y,
			axis?.minorTickMark,
			'right',
			MINOR_TICK_LENGTH,
			axis?.spPr,
		);
		if (tick) {
			gridlines.push(tick);
		}
	}
	for (const val of tickValues) {
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
		gridlines.push(
			buildStyledGridline(
				y,
				layout,
				axis?.majorGridlinesSpPr,
				SECONDARY_GRID_COLOR,
				0.5,
				'2 3',
				0.5,
			),
		);
		const tick = buildVerticalTickMark(
			axisX,
			y,
			axis?.majorTickMark,
			'right',
			MAJOR_TICK_LENGTH,
			axis?.spPr,
		);
		if (tick) {
			gridlines.push(tick);
		}
		if (axis?.tickLblPos !== 'none') {
			axisLabels.push({
				kind: 'text',
				...valueAxisLabelPlacement(layout, axis?.tickLblPos, 'right', axisX),
				y,
				text: formatTick(val, axis),
				...textStyle,
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
			...captionStyle,
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
				...captionStyle,
				textAnchor: 'middle',
				transform: `rotate(-90, ${labelX}, ${midY})`,
			});
		}
	}

	return { gridlines, axisLabels };
}
