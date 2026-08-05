import type { PptxChartAxisFormatting, PptxChartShapeProps } from 'pptx-viewer-core';

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
