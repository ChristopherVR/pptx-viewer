import type {
	PptxChartAxisFormatting,
	PptxChartDisplayUnitsLabel,
	PptxChartShapeProps,
} from 'pptx-viewer-core';

import { DEFAULT_CHART_TEXT_PX, chartFontPx } from './chart-font';
import type { SvgLine, SvgText } from './chart-view-model';

const DEFAULT_COLOR = '#64748b';

function dashArray(style: string | undefined, width: number): string | undefined {
	if (!style || style === 'solid') {
		return undefined;
	}
	const unit = Math.max(width, 1);
	if (style === 'dot' || style === 'sysDot') {
		return `${unit} ${unit * 2}`;
	}
	if (style === 'lgDash') {
		return `${unit * 6} ${unit * 3}`;
	}
	return `${unit * 3} ${unit * 2}`;
}

/**
 * SvgText style for axis-driven chart text (tick labels, category labels,
 * captions). `axis.fontSize` is parsed in POINTS by core; it crosses the
 * pt -> px boundary exactly here (see chart-font.ts). `defaultFontSizePx` is
 * already px and defaults to PowerPoint's 10 pt chart text (13.33 px).
 */
export function chartAxisTextStyle(
	axis: PptxChartAxisFormatting | undefined,
	defaultFontSizePx = DEFAULT_CHART_TEXT_PX,
): Pick<SvgText, 'fontSize' | 'fill' | 'fontWeight' | 'fontFamily'> {
	return {
		fontSize: axis?.fontSize !== undefined ? chartFontPx(axis.fontSize) : defaultFontSizePx,
		fill: axis?.fontColor ?? DEFAULT_COLOR,
		...(axis?.fontBold !== undefined ? { fontWeight: axis.fontBold ? 'bold' : 'normal' } : {}),
		...(axis?.fontFamily ? { fontFamily: axis.fontFamily } : {}),
	};
}

/**
 * Text style for a display-units caption (`c:dispUnitsLbl` /
 * ChartEx `cx:unitsLabel`), starting from the axis's own text style and
 * overriding with the label's distinct `txPr` when one was parsed (only a
 * ChartEx `cx:unitsLabel/cx:txPr` populates these fields today; classic
 * `c:dispUnitsLbl` has no run-font child of its own).
 */
export function unitsLabelTextStyle(
	axis: PptxChartAxisFormatting | undefined,
	baseStyle: Pick<SvgText, 'fontSize' | 'fill' | 'fontWeight' | 'fontFamily'>,
): Pick<SvgText, 'fontSize' | 'fill' | 'fontWeight' | 'fontFamily'> {
	const label = axis?.displayUnitsLabel;
	if (typeof label !== 'object' || label === null) {
		return baseStyle;
	}
	const { fontFamily, fontSize, fontBold, fontColor } = label as PptxChartDisplayUnitsLabel;
	return {
		...baseStyle,
		...(fontSize !== undefined ? { fontSize: chartFontPx(fontSize) } : {}),
		...(fontColor ? { fill: fontColor } : {}),
		...(fontBold !== undefined ? { fontWeight: fontBold ? 'bold' : 'normal' } : {}),
		...(fontFamily ? { fontFamily } : {}),
	};
}

export function chartLineStyle(
	shape: PptxChartShapeProps | null | undefined,
	fallbackColor = DEFAULT_COLOR,
	fallbackWidth = 1,
): Pick<SvgLine, 'stroke' | 'strokeWidth' | 'dashArray'> {
	const strokeWidth = shape?.strokeWidth ?? fallbackWidth;
	return {
		stroke: shape?.strokeColor ?? fallbackColor,
		strokeWidth,
		...(dashArray(shape?.strokeDashStyle, strokeWidth)
			? { dashArray: dashArray(shape?.strokeDashStyle, strokeWidth) }
			: {}),
	};
}
