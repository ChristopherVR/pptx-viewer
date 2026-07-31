import type {
	PptxChartData,
	PptxChartDataLabelPosition,
	PptxChartErrBarDir,
	PptxChartErrBarType,
	PptxChartMarkerSymbol,
	PptxChartType,
} from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import { numbers, set, setOptions, value } from './chart-exhaustive-controls';
import { createChartExhaustiveFields } from './chart-exhaustive-fields';

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
	const {
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
		seriesFields,
		axisFields,
	} = createChartExhaustiveFields(doc, t);
	el.append(
		series.label,
		...seriesFields.map(({ label }) => label),
		axis.label,
		...axisFields.map(({ label }) => label),
	);
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
	for (const field of seriesFields) {
		field.control.addEventListener('change', commitSeries);
	}
	for (const field of axisFields) {
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
