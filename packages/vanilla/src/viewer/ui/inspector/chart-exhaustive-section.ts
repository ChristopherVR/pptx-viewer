import type {
	PptxChartData,
	PptxChartDataLabelPosition,
	PptxChartErrBarDir,
	PptxChartErrBarType,
	PptxChartMarkerSymbol,
	PptxChartType,
} from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import {
	checkbox,
	color,
	input,
	number,
	numbers,
	select,
	set,
	setOptions,
	value,
} from './chart-exhaustive-controls';

export interface ChartExhaustiveSection {
	el: HTMLElement;
	update(data: PptxChartData): void;
}

export function createChartExhaustiveSection(
	doc: Document,
	t: Translator,
	onChange: (data: PptxChartData) => void,
): ChartExhaustiveSection {
	const el = doc.createElement('div');
	el.className = 'pptxv-chart-exhaustive';
	const series = select(doc, t('pptx.chart.series'), []);
	const comboType = select(doc, t('pptx.chart.seriesType'), [
		'bar',
		'line',
		'area',
		'scatter',
		'bubble',
		'radar',
	]);
	const secondaryAxis = checkbox(doc, t('pptx.chart.secondaryAxis'));
	const labelPosition = select(doc, t('pptx.chart.dataLabelPosition'), [
		'bestFit',
		'b',
		'ctr',
		'inBase',
		'inEnd',
		'l',
		'outEnd',
		'r',
		't',
	]);
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
	const trendColor = color(doc, t('pptx.chart.trendlineColor'));
	const errorDirection = select(doc, t('pptx.chart.errorBarDirection'), ['x', 'y']);
	const errorBarType = select(doc, t('pptx.chart.errorBarType'), ['both', 'minus', 'plus']);
	const errorColor = color(doc, t('pptx.chart.errorBarColor'));
	const noEndCap = checkbox(doc, t('pptx.chart.noEndCap'));
	const customPlus = input(doc, t('pptx.chart.customPlus'));
	const customMinus = input(doc, t('pptx.chart.customMinus'));
	const markerFill = color(doc, t('pptx.chart.markerFill'));
	const markerLine = color(doc, t('pptx.chart.markerOutline'));
	const pointMarker = select(doc, t('pptx.chart.dataPointMarker'), [
		'none',
		'circle',
		'diamond',
		'square',
		'star',
		'triangle',
		'x',
		'plus',
	]);
	const pointMarkerSize = number(doc, t('pptx.chart.markerSize'));
	const pointInvert = checkbox(doc, t('pptx.chart.invertIfNegative'));
	const axis = select(doc, t('pptx.chart.axis'), []);
	const axisTitle = input(doc, t('pptx.chart.axisTitle'));
	const minorUnit = number(doc, t('pptx.chart.minorUnit'));
	const minorGridlines = checkbox(doc, t('pptx.chart.minorGridlines'));
	const numberFormat = input(doc, t('pptx.chart.numberFormat'));
	const tickPosition = select(doc, t('pptx.chart.tickLabelPosition'), [
		'nextTo',
		'high',
		'low',
		'none',
	]);
	const axisColor = color(doc, t('pptx.chart.axisColor'));
	const axisFontColor = color(doc, t('pptx.chart.axisFontColor'));
	const axisFontSize = number(doc, t('pptx.chart.axisFontSize'));
	const fields = [
		series,
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
		axis,
		axisTitle,
		minorUnit,
		minorGridlines,
		numberFormat,
		tickPosition,
		axisColor,
		axisFontColor,
		axisFontSize,
	];
	el.append(...fields.map(({ label }) => label));
	let current: PptxChartData | undefined;
	const seriesIndex = () => Math.max(0, series.control.selectedIndex);
	const axisIndex = () => Math.max(0, axis.control.selectedIndex);
	const commitSeries = (): void => {
		const item = current?.series[seriesIndex()];
		if (!current || !item) {
			return;
		}
		const next = [...current.series];
		const trend = item.trendlines?.[0];
		const error = item.errBars?.[0];
		const point = item.dataPoints?.[0] ?? { idx: 0 };
		next[seriesIndex()] = {
			...item,
			seriesChartType: comboType.control.value as PptxChartType,
			axisId: secondaryAxis.control.checked
				? current.axes?.find((candidate) => candidate.axPos === 'r')?.axisId
				: current.axes?.find((candidate) => candidate.axPos === 'l')?.axisId,
			trendlines: trend
				? [
						{
							...trend,
							order: value(trendOrder.control),
							period: value(trendPeriod.control),
							forward: value(trendForward.control),
							backward: value(trendBackward.control),
							intercept: value(trendIntercept.control),
							color: trendColor.control.value,
						},
					]
				: [],
			errBars: error
				? [
						{
							...error,
							direction: errorDirection.control.value as PptxChartErrBarDir,
							barType: errorBarType.control.value as PptxChartErrBarType,
							color: errorColor.control.value,
							noEndCap: noEndCap.control.checked,
							customPlus: numbers(customPlus.control.value),
							customMinus: numbers(customMinus.control.value),
						},
					]
				: [],
			marker: {
				...(item.marker ?? { symbol: 'auto' }),
				spPr: { fillColor: markerFill.control.value, strokeColor: markerLine.control.value },
			},
			dataPoints: [
				{
					...point,
					invertIfNegative: pointInvert.control.checked,
					marker: {
						symbol: pointMarker.control.value as PptxChartMarkerSymbol,
						size: value(pointMarkerSize.control),
					},
				},
				...(item.dataPoints?.slice(1) ?? []),
			],
		};
		onChange({
			...current,
			series: next,
			style: {
				...current.style,
				hasDataLabels: true,
				dataLabels: {
					...current.style?.dataLabels,
					position: labelPosition.control.value as PptxChartDataLabelPosition,
					showValue: showValue.control.checked,
					showCategory: showCategory.control.checked,
					showSeriesName: showSeries.control.checked,
					showPercent: showPercent.control.checked,
					showLeaderLines: leaderLines.control.checked,
				},
			},
		});
	};
	const commitAxis = (): void => {
		const selected = current?.axes?.[axisIndex()];
		if (!current || !selected) {
			return;
		}
		const axes = [...(current.axes ?? [])];
		axes[axisIndex()] = {
			...selected,
			titleText: axisTitle.control.value,
			minorUnit: value(minorUnit.control),
			minorGridlines: minorGridlines.control.checked,
			numFmt: { formatCode: numberFormat.control.value },
			tickLblPos: tickPosition.control.value as typeof selected.tickLblPos,
			spPr: { ...selected.spPr, strokeColor: axisColor.control.value },
			fontColor: axisFontColor.control.value,
			fontSize: value(axisFontSize.control),
		};
		onChange({ ...current, axes });
	};
	for (const field of fields.slice(1, 26)) {
		field.control.addEventListener('change', commitSeries);
	}
	for (const field of fields.slice(27)) {
		field.control.addEventListener('change', commitAxis);
	}
	series.control.addEventListener('change', () => current && sync(current));
	axis.control.addEventListener('change', () => current && sync(current));
	const sync = (data: PptxChartData): void => {
		current = data;
		setOptions(
			doc,
			series.control,
			data.series.map((item, index) => [String(index), item.name]),
		);
		setOptions(
			doc,
			axis.control,
			(data.axes ?? []).map((item, index) => [String(index), item.titleText ?? item.axisType]),
		);
		const item = data.series[seriesIndex()];
		const trend = item?.trendlines?.[0];
		const error = item?.errBars?.[0];
		comboType.control.value = item?.seriesChartType ?? data.chartType;
		secondaryAxis.control.checked = Boolean(
			item?.axisId && data.axes?.find((a) => a.axisId === item.axisId)?.axPos === 'r',
		);
		const labels = data.style?.dataLabels;
		labelPosition.control.value = labels?.position ?? 'bestFit';
		showValue.control.checked = labels?.showValue ?? false;
		showCategory.control.checked = labels?.showCategory ?? false;
		showSeries.control.checked = labels?.showSeriesName ?? false;
		showPercent.control.checked = labels?.showPercent ?? false;
		leaderLines.control.checked = labels?.showLeaderLines ?? false;
		set(trendOrder.control, trend?.order);
		set(trendPeriod.control, trend?.period);
		set(trendForward.control, trend?.forward);
		set(trendBackward.control, trend?.backward);
		set(trendIntercept.control, trend?.intercept);
		trendColor.control.value = trend?.color ?? '#4472c4';
		errorDirection.control.value = error?.direction ?? 'y';
		errorBarType.control.value = error?.barType ?? 'both';
		errorColor.control.value = error?.color ?? '#000000';
		noEndCap.control.checked = error?.noEndCap ?? false;
		customPlus.control.value = error?.customPlus?.join(', ') ?? '';
		customMinus.control.value = error?.customMinus?.join(', ') ?? '';
		markerFill.control.value = item?.marker?.spPr?.fillColor ?? '#4472c4';
		markerLine.control.value = item?.marker?.spPr?.strokeColor ?? '#000000';
		pointMarker.control.value = item?.dataPoints?.[0]?.marker?.symbol ?? 'none';
		set(pointMarkerSize.control, item?.dataPoints?.[0]?.marker?.size);
		pointInvert.control.checked = item?.dataPoints?.[0]?.invertIfNegative ?? false;
		const selectedAxis = data.axes?.[axisIndex()];
		axisTitle.control.value = selectedAxis?.titleText ?? '';
		set(minorUnit.control, selectedAxis?.minorUnit);
		minorGridlines.control.checked = selectedAxis?.minorGridlines ?? false;
		numberFormat.control.value = selectedAxis?.numFmt?.formatCode ?? '';
		tickPosition.control.value = selectedAxis?.tickLblPos ?? 'nextTo';
		axisColor.control.value = selectedAxis?.spPr?.strokeColor ?? '#000000';
		axisFontColor.control.value = selectedAxis?.fontColor ?? '#000000';
		set(axisFontSize.control, selectedAxis?.fontSize);
	};
	return { el, update: sync };
}
