/**
 * chart-exhaustive-fields.ts: the control inventory of the vanilla chart
 * inspector's exhaustive section.
 *
 * Split out of `chart-exhaustive-section.ts`, which had grown past the repo's
 * ~300-LOC ceiling with two thirds of its body being field construction. This
 * module owns WHICH controls exist and which commit handler each belongs to;
 * the section keeps the reading/writing of chart data.
 *
 * The `seriesFields` / `axisFields` grouping is the load-bearing part. The
 * section used to attach its change listeners with `fields.slice(1, 26)` and
 * `fields.slice(27)` over a single render-order array, so inserting one control
 * shifted a neighbour into the wrong handler (or out of both) with nothing to
 * catch it. Grouping them here makes the intent explicit and the render order a
 * consequence of the grouping rather than a parallel list to keep in sync.
 *
 * @module vanilla/inspector/chart-exhaustive-fields
 */
import {
	CHART_DATA_LABEL_POSITION_LABEL_KEYS,
	CHART_ERROR_BAR_DIRECTION_LABEL_KEYS,
	CHART_TYPE_LABEL_KEYS,
	ERROR_BAR_TYPE_OPTIONS,
	MARKER_SYMBOL_OPTIONS,
	TICK_LABEL_POSITION_OPTIONS,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import {
	checkbox,
	color,
	input,
	number,
	optionSelect,
	select,
	tokenSelect,
} from './chart-exhaustive-controls';

/** Concrete marker symbols; the '' entry is the "series default" sentinel. */
const POINT_MARKER_OPTIONS = MARKER_SYMBOL_OPTIONS.filter((option) => option.value !== '');

/** Build every control of the exhaustive section, grouped by commit handler. */
export function createChartExhaustiveFields(
	doc: Document,
	t: Translator,
	/** B6: pushes a committed colour into the deck's "Recent colours" MRU list. */
	pushRecentColor?: (hex: string) => void,
) {
	const series = select(doc, t('pptx.chart.series'), []);
	// Not `COMBO_SERIES_TYPE_OPTIONS`: that catalogue carries a '' default and
	// stops at four types, where this select offers six concrete ones and no
	// sentinel. Only the spelling comes from shared, so the six values stand.
	const comboType = tokenSelect(
		doc,
		t('pptx.chart.seriesType'),
		['bar', 'line', 'area', 'scatter', 'bubble', 'radar'],
		CHART_TYPE_LABEL_KEYS,
		t,
	);
	const secondaryAxis = checkbox(doc, t('pptx.chart.secondaryAxis'));
	// Likewise wider than `DATA_LABEL_POSITION_OPTIONS`, which omits the
	// above/below/left/right positions line and scatter charts accept; those four
	// were the ones showing up as a bare `t`, `b`, `l`, `r`.
	const labelPosition = tokenSelect(
		doc,
		t('pptx.chart.dataLabelPosition'),
		['bestFit', 'b', 'ctr', 'inBase', 'inEnd', 'l', 'outEnd', 'r', 't'],
		CHART_DATA_LABEL_POSITION_LABEL_KEYS,
		t,
	);
	const showValue = checkbox(doc, t('pptx.chart.showValue'));
	const showCategory = checkbox(doc, t('pptx.chart.showCategory'));
	const showSeries = checkbox(doc, t('pptx.chart.showSeriesName'));
	const showPercent = checkbox(doc, t('pptx.chart.showPercentage'));
	const leaderLines = checkbox(doc, t('pptx.chart.showLeaderLines'));
	const trendOrder = number(doc, t('pptx.chart.trendlineOrder'));
	const trendPeriod = number(doc, t('pptx.chart.trendlinePeriod'));
	const trendForward = number(doc, t('pptx.chart.forecastForward'));
	const trendBackward = number(doc, t('pptx.chart.forecastBackward'));
	const trendIntercept = number(doc, t('pptx.chart.trendlineIntercept'));
	const trendColor = color(doc, t('pptx.chart.trendlineColor'), pushRecentColor);
	const errorDirection = tokenSelect(
		doc,
		t('pptx.chart.errorBarDirection'),
		['x', 'y'],
		CHART_ERROR_BAR_DIRECTION_LABEL_KEYS,
		t,
	);
	// The shared catalogue holds exactly these three `c:errBarType` values, so it
	// can drive the control outright.
	const errorBarType = optionSelect(doc, t('pptx.chart.errorBarType'), ERROR_BAR_TYPE_OPTIONS, t);
	const errorColor = color(doc, t('pptx.chart.errorBarColor'), pushRecentColor);
	const noEndCap = checkbox(doc, t('pptx.chart.noEndCap'));
	const customPlus = input(doc, t('pptx.chart.customPlus'));
	const customMinus = input(doc, t('pptx.chart.customMinus'));
	const markerFill = color(doc, t('pptx.chart.markerFill'), pushRecentColor);
	const markerLine = color(doc, t('pptx.chart.markerOutline'), pushRecentColor);
	const pointMarker = optionSelect(doc, t('pptx.chart.dataPointMarker'), POINT_MARKER_OPTIONS, t);
	const pointMarkerSize = number(doc, t('pptx.chart.markerSize'));
	const pointInvert = checkbox(doc, t('pptx.chart.invertIfNegative'));
	const axis = select(doc, t('pptx.chart.axis'), []);
	const axisTitle = input(doc, t('pptx.chart.axisTitle'));
	const minorUnit = number(doc, t('pptx.chart.minorUnit'));
	const minorGridlines = checkbox(doc, t('pptx.chart.minorGridlines'));
	const numberFormat = input(doc, t('pptx.chart.numberFormat'));
	const tickPosition = optionSelect(
		doc,
		t('pptx.chart.tickLabelPosition'),
		TICK_LABEL_POSITION_OPTIONS,
		t,
	);
	const axisColor = color(doc, t('pptx.chart.axisColor'), pushRecentColor);
	const axisFontColor = color(doc, t('pptx.chart.axisFontColor'), pushRecentColor);
	const axisFontSize = number(doc, t('pptx.chart.axisFontSize'));

	return {
		series,
		axis,
		comboType,
		secondaryAxis,
		labelPosition,
		showValue,
		showCategory,
		showSeries,
		showPercent,
		leaderLines,
		trendOrder,
		trendPeriod,
		trendForward,
		trendBackward,
		trendIntercept,
		trendColor,
		errorDirection,
		errorBarType,
		errorColor,
		noEndCap,
		customPlus,
		customMinus,
		markerFill,
		markerLine,
		pointMarker,
		pointMarkerSize,
		pointInvert,
		axisTitle,
		minorUnit,
		minorGridlines,
		numberFormat,
		tickPosition,
		axisColor,
		axisFontColor,
		axisFontSize,
		/** Controls the section commits through its series handler. */
		seriesFields: [
			comboType,
			secondaryAxis,
			labelPosition,
			showValue,
			showCategory,
			showSeries,
			showPercent,
			leaderLines,
			trendOrder,
			trendPeriod,
			trendForward,
			trendBackward,
			trendIntercept,
			trendColor,
			errorDirection,
			errorBarType,
			errorColor,
			noEndCap,
			customPlus,
			customMinus,
			markerFill,
			markerLine,
			pointMarker,
			pointMarkerSize,
			pointInvert,
		],
		/** Controls the section commits through its axis handler. */
		axisFields: [
			axisTitle,
			minorUnit,
			minorGridlines,
			numberFormat,
			tickPosition,
			axisColor,
			axisFontColor,
			axisFontSize,
		],
	};
}

/** Every control of the exhaustive section, as built above. */
export type ChartExhaustiveFields = ReturnType<typeof createChartExhaustiveFields>;
