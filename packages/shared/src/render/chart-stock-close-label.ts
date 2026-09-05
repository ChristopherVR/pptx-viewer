/**
 * chart-stock-close-label.ts: the close-price data label for a stock
 * (HLC/OHLC) chart candle (limitations.md "Stock/candlestick 'close' label").
 *
 * The candle body/wick geometry lives in `chart-combo-stock.ts`; this module
 * owns only the close series' own data label, which used to be a fixed
 * `formatAxisValue(close)` string drawn a constant 4px above the candle's
 * high point regardless of the close series' own `c:dLbls`/`c:dLbl` content
 * flags, number format, or `c:dLblPos`. Routing it through the same
 * `buildDataLabelText`/`resolveMarkerLabelPlacement` cascade every other
 * chart kind's markers use (CLAUDE.md Rule 2: one shared pipeline, not a
 * stock-specific reimplementation) fixes all three at once and adds
 * per-point manual-drag support for free.
 *
 * @module chart-stock-close-label
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { resolveMarkerLabelPlacement } from './chart-data-label-anchor';
import {
	buildDataLabelText,
	dataLabelFontOverride,
	resolveDataLabelTextStyle,
} from './chart-data-label-text';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type { SvgText } from './chart-view-model';

/**
 * Build the close series' own label for one candle. Returns `undefined` when
 * the label resolves to nothing (deleted, or every content flag off), same
 * as every other `buildDataLabelText` consumer.
 *
 * `x`/`closeY` are the candle's own tick position (the close value's pixel
 * coordinate), not the candle's high point: PowerPoint anchors this label to
 * the close tick, defaulting to its right (`'r'`) when the close series'
 * `c:dLblPos` cascade authored no position, distinct from line/scatter
 * markers' own "above the point" default.
 */
export function buildStockCloseLabel(
	chartData: PptxChartData,
	closeSeries: PptxChartSeries,
	sourceIndex: number,
	close: number,
	x: number,
	closeY: number,
	frame: { width: number; height: number },
): SvgText | undefined {
	const label = buildDataLabelText({
		chartData,
		series: closeSeries,
		pointIndex: sourceIndex,
		value: close,
	});
	if (label === undefined) {
		return undefined;
	}
	const anchor = resolveMarkerLabelPlacement(
		chartData,
		closeSeries,
		sourceIndex,
		{ x, y: closeY },
		frame,
		6,
		'r',
	);
	return {
		kind: 'text',
		x: anchor.x,
		y: anchor.y,
		text: label.text,
		fontSize: DEFAULT_CHART_DATA_LABEL_PX,
		fill: label.color ?? '#334155',
		textAnchor: anchor.textAnchor,
		...(anchor.dominantBaseline ? { dominantBaseline: anchor.dominantBaseline } : {}),
		...dataLabelFontOverride(resolveDataLabelTextStyle(chartData, closeSeries, sourceIndex)),
	};
}
