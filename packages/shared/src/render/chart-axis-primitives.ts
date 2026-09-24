import type { PptxChartAxisFormatting, PptxChartShapeProps } from 'pptx-viewer-core';

import { chartLineStyle } from './chart-axis-style';
import type { PlotLayout, SvgLine } from './chart-view-model';

export function buildVerticalTickMark(
	axisX: number,
	y: number,
	placement: PptxChartAxisFormatting['majorTickMark'],
	side: 'left' | 'right',
	length: number,
	shape: PptxChartShapeProps | undefined,
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
		...chartLineStyle(shape),
	};
}

export function buildVerticalAxisLine(
	axis: PptxChartAxisFormatting | undefined,
	axisX: number,
	layout: PlotLayout,
): SvgLine | undefined {
	return axis?.spPr
		? {
				kind: 'line',
				x1: axisX,
				y1: layout.plotTop,
				x2: axisX,
				y2: layout.plotBottom,
				...chartLineStyle(axis.spPr),
			}
		: undefined;
}

export function buildStyledGridline(
	y: number,
	layout: PlotLayout,
	shape: PptxChartShapeProps | undefined,
	fallbackColor: string,
	fallbackWidth: number,
	fallbackDash: string | undefined,
	opacity: number | undefined,
): SvgLine {
	const style = chartLineStyle(shape, fallbackColor, fallbackWidth);
	return {
		kind: 'line',
		x1: layout.plotLeft,
		y1: y,
		x2: layout.plotRight,
		y2: y,
		...style,
		...((shape ? style.dashArray : fallbackDash)
			? { dashArray: shape ? style.dashArray : fallbackDash }
			: {}),
		...(opacity !== undefined ? { opacity } : {}),
	};
}

/**
 * A vertical major/minor gridline spanning the full plot height at `x`.
 * `buildStyledGridline`'s counterpart for a scatter/bubble chart's X value
 * axis (`c:valAx/@axPos="b"`), which is a real numeric axis with its own
 * `c:majorGridlines`, not the category axis every other cartesian kind draws.
 */
export function buildVerticalStyledGridline(
	x: number,
	layout: PlotLayout,
	shape: PptxChartShapeProps | undefined,
	fallbackColor: string,
	fallbackWidth: number,
	fallbackDash: string | undefined,
	opacity: number | undefined,
): SvgLine {
	const style = chartLineStyle(shape, fallbackColor, fallbackWidth);
	return {
		kind: 'line',
		x1: x,
		y1: layout.plotTop,
		x2: x,
		y2: layout.plotBottom,
		...style,
		...((shape ? style.dashArray : fallbackDash)
			? { dashArray: shape ? style.dashArray : fallbackDash }
			: {}),
		...(opacity !== undefined ? { opacity } : {}),
	};
}
