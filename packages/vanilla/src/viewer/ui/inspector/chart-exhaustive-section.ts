import type {
	PptxChartData,
	PptxChartDataLabelPosition,
	PptxChartErrBarDir,
	PptxChartErrBarType,
	PptxChartMarkerSymbol,
	PptxChartType,
} from 'pptx-viewer-core';
import { CHART_AXIS_TYPE_LABEL_KEYS, schemaLabel, upsertDataPoint } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { numbers, set, setOptions, value } from './chart-exhaustive-controls';
import { createChartExhaustiveFields } from './chart-exhaustive-fields';
import type { ChartPointIndexField } from './chart-point-index';
import { createChartPointIndexField } from './chart-point-index';

export interface ChartExhaustiveSection {
	el: HTMLElement;
	update(data: PptxChartData): void;
}

export function createChartExhaustiveSection(
	doc: Document,
	t: Translator,
	onChange: (data: PptxChartData) => void,
	/**
	 * The point picker the per-point marker controls obey. The chart section
	 * hands over the SAME instance the advanced section renders, so one box
	 * drives every `c:dPt` control; when omitted this section renders its own,
	 * which keeps it operable (and unit-testable) on its own.
	 */
	pointIndex?: ChartPointIndexField,
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
	const ownsPointPicker = pointIndex === undefined;
	const pointPicker = pointIndex ?? createChartPointIndexField(doc, t);
	el.append(
		series.label,
		...(ownsPointPicker ? [pointPicker.label] : []),
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
		// `c:dPt` entries are sparse and keyed by `c:idx`, so the override has to
		// be looked up by the picked index; the old `dataPoints[0]` pinned every
		// per-point edit to whichever override happened to be first.
		const pointIdx = pointPicker.selected();
		const point = item.dataPoints?.find(({ idx }) => idx === pointIdx);
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
			dataPoints: upsertDataPoint(item.dataPoints, {
				...(point ?? { idx: pointIdx }),
				invertIfNegative: pointInvert.control.checked,
				marker: {
					// Keep any per-point marker fill the point already carries: the
					// section offers no control for it, and dropping it here would
					// undo an edit made in another binding.
					...point?.marker,
					symbol: pointMarker.control.value as PptxChartMarkerSymbol,
					size: value(pointMarkerSize.control),
				},
			}),
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
	// Picking a different point re-reads its override rather than committing, so
	// the values still on screen for the previous point are not copied across.
	pointPicker.subscribe(() => current && sync(current));
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
			// As in the advanced section: an untitled axis captions itself with its
			// element name, which must be spelled rather than shown as `catAx`.
			(data.axes ?? []).map((item, index) => [
				String(index),
				item.titleText ?? schemaLabel(CHART_AXIS_TYPE_LABEL_KEYS, item.axisType, t),
			]),
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
		const selectedPoint = item?.dataPoints?.find(({ idx }) => idx === pointPicker.selected());
		pointMarker.control.value = selectedPoint?.marker?.symbol ?? 'none';
		set(pointMarkerSize.control, selectedPoint?.marker?.size);
		pointInvert.control.checked = selectedPoint?.invertIfNegative ?? false;
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
