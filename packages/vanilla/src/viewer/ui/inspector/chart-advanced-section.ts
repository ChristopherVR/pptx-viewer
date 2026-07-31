/**
 * chart-advanced-section.ts: the axis-scale and per-series formatting block of
 * the vanilla chart inspector.
 *
 * The control primitives come from `chart-exhaustive-controls`, which the
 * sibling exhaustive section also uses; this file used to carry byte-identical
 * private copies of all seven of them.
 */
import type {
	PptxChartAxisFormatting,
	PptxChartData,
	PptxChartErrBars,
	PptxChartMarkerSymbol,
	PptxChartTrendlineType,
} from 'pptx-viewer-core';
import {
	CHART_AXIS_TYPE_LABEL_KEYS,
	CHART_MARKER_SYMBOL_LABEL_KEYS,
	DISPLAY_UNITS_OPTIONS,
	ERROR_BAR_VALTYPE_OPTIONS,
	schemaLabel,
	TRENDLINE_TYPE_OPTIONS,
	upsertDataPoint,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import {
	checkbox,
	color,
	number,
	optionSelect,
	select,
	set,
	setOptions,
	tokenSelect,
	value as optionalNumber,
} from './chart-exhaustive-controls';
import type { ChartPointIndexField } from './chart-point-index';
import { createChartPointIndexField } from './chart-point-index';

export interface ChartAdvancedSection {
	el: HTMLElement;
	update(data: PptxChartData): void;
}

export function createChartAdvancedSection(
	doc: Document,
	t: Translator,
	onChange: (data: PptxChartData) => void,
	/**
	 * The point picker to obey. The chart section passes the SAME instance to
	 * the exhaustive section so a single box drives every per-point control;
	 * omitting it (as the unit tests do) gives this section a private one.
	 */
	pointIndex: ChartPointIndexField = createChartPointIndexField(doc, t),
): ChartAdvancedSection {
	const el = doc.createElement('div');
	el.className = 'pptxv-chart-advanced';
	const axisSelect = select(doc, t('pptx.chart.axis'), []);
	const min = number(doc, t('pptx.chart.axisMinimum'));
	const max = number(doc, t('pptx.chart.axisMaximum'));
	const majorUnit = number(doc, t('pptx.chart.majorUnit'));
	// Sits with the scale controls, as it does in React's `ChartAxisOptions`:
	// `c:dispUnits` divides the plotted values and appends the unit label, so it
	// belongs next to min/max/major rather than with the cosmetic axis styling.
	const displayUnits = optionSelect(doc, t('pptx.chart.displayUnits'), DISPLAY_UNITS_OPTIONS, t);
	const logScale = checkbox(doc, t('pptx.chart.logScale'));
	const reverse = checkbox(doc, t('pptx.chart.reverseOrder'));
	const gridlines = checkbox(doc, t('pptx.chart.majorGridlines'));
	const seriesSelect = select(doc, t('pptx.chart.series'), []);
	// The trendline and error-bar value lists were local literals that happened to
	// match `chart-editor-options` entry for entry, so driving them from the
	// shared catalogues changes nothing about what is offered while giving the
	// options words instead of `movingAvg` and `stdErr`.
	const trendline = optionSelect(doc, t('pptx.chart.trendlines'), TRENDLINE_TYPE_OPTIONS, t);
	const equation = checkbox(doc, t('pptx.chart.trendlineEquation'));
	const rSquared = checkbox(doc, t('pptx.chart.trendlineRSquared'));
	const errorType = optionSelect(doc, t('pptx.chart.errorBars'), ERROR_BAR_VALTYPE_OPTIONS, t);
	const errorAmount = number(doc, t('pptx.chart.errorBarAmount'));
	// Not `MARKER_SYMBOL_OPTIONS`: this select offers an explicit `auto` value
	// where the shared list spells "auto" as the empty string, so switching
	// catalogues would silently rewrite what the control writes to `c:symbol`.
	// Only the spelling is taken from shared.
	const marker = tokenSelect(
		doc,
		t('pptx.chart.marker'),
		['none', 'auto', 'circle', 'diamond', 'square', 'star', 'triangle', 'x', 'plus'],
		CHART_MARKER_SYMBOL_LABEL_KEYS,
		t,
	);
	const markerSize = number(doc, t('pptx.chart.markerSize'));
	const seriesColor = color(doc, t('pptx.chart.seriesColor'));
	const pointColor = color(doc, t('pptx.chart.dataPointColor'));
	const pointExplosion = number(doc, t('pptx.chart.pointExplosion'));
	el.append(
		axisSelect.label,
		min.label,
		max.label,
		majorUnit.label,
		displayUnits.label,
		logScale.label,
		reverse.label,
		gridlines.label,
		seriesSelect.label,
		trendline.label,
		equation.label,
		rSquared.label,
		errorType.label,
		errorAmount.label,
		marker.label,
		markerSize.label,
		seriesColor.label,
		pointIndex.label,
		pointColor.label,
		pointExplosion.label,
	);

	let current: PptxChartData | undefined;
	const axisIndex = (): number => Math.max(0, axisSelect.control.selectedIndex);
	const seriesIndex = (): number => Math.max(0, seriesSelect.control.selectedIndex);
	const commitAxis = (): void => {
		if (!current) {
			return;
		}
		const axes = [...(current.axes ?? [])];
		const previous = axes[axisIndex()] ?? ({ axisType: 'valAx' } as PptxChartAxisFormatting);
		axes[axisIndex()] = {
			...previous,
			min: optionalNumber(min.control),
			max: optionalNumber(max.control),
			majorUnit: optionalNumber(majorUnit.control),
			// '' is the "None" entry: clear `c:dispUnits` rather than writing an
			// empty token the schema does not accept.
			displayUnits: (displayUnits.control.value ||
				undefined) as PptxChartAxisFormatting['displayUnits'],
			logScale: logScale.control.checked,
			orientation: reverse.control.checked ? 'maxMin' : 'minMax',
			majorGridlines: gridlines.control.checked,
		};
		onChange({ ...current, axes });
	};
	const commitSeries = (): void => {
		if (!current?.series[seriesIndex()]) {
			return;
		}
		const series = [...current.series];
		const previous = series[seriesIndex()];
		const trendlineType = trendline.control.value as PptxChartTrendlineType | '';
		const valType = errorType.control.value as PptxChartErrBars['valType'] | '';
		const point = pointIndex.selected();
		const existing = previous.dataPoints?.find(({ idx }) => idx === point);
		const dataPoints = upsertDataPoint(previous.dataPoints, {
			...(existing ?? { idx: point }),
			spPr: { ...existing?.spPr, fillColor: pointColor.control.value },
			explosion: optionalNumber(pointExplosion.control),
		});
		series[seriesIndex()] = {
			...previous,
			color: seriesColor.control.value,
			trendlines: trendlineType
				? [
						{
							trendlineType,
							displayEq: equation.control.checked,
							displayRSq: rSquared.control.checked,
						},
					]
				: [],
			errBars: valType
				? [{ direction: 'y', barType: 'both', valType, val: optionalNumber(errorAmount.control) }]
				: [],
			marker: {
				symbol: marker.control.value as PptxChartMarkerSymbol,
				size: optionalNumber(markerSize.control),
			},
			dataPoints,
		};
		onChange({ ...current, series });
	};
	for (const control of [
		min.control,
		max.control,
		majorUnit.control,
		displayUnits.control,
		logScale.control,
		reverse.control,
		gridlines.control,
	]) {
		control.addEventListener('change', commitAxis);
	}
	for (const control of [
		trendline.control,
		equation.control,
		rSquared.control,
		errorType.control,
		errorAmount.control,
		marker.control,
		markerSize.control,
		seriesColor.control,
		pointColor.control,
		pointExplosion.control,
	]) {
		control.addEventListener('change', commitSeries);
	}
	axisSelect.control.addEventListener('change', () => current && sync(current));
	seriesSelect.control.addEventListener('change', () => current && sync(current));
	// Picking a different point RE-READS it; it must not commit, or the colour
	// still showing for the previous point would be stamped onto the new one.
	pointIndex.subscribe(() => current && sync(current));

	const sync = (data: PptxChartData): void => {
		current = data;
		setOptions(
			doc,
			axisSelect.control,
			// An untitled axis falls back to its element name, which used to reach
			// the user as the literal `valAx`; spell it through the shared map.
			(data.axes ?? []).map((axis, index) => [
				String(index),
				axis.titleText ?? schemaLabel(CHART_AXIS_TYPE_LABEL_KEYS, axis.axisType, t),
			]),
		);
		setOptions(
			doc,
			seriesSelect.control,
			data.series.map((item, index) => [String(index), item.name]),
		);
		const axis = data.axes?.[axisIndex()];
		set(min.control, axis?.min);
		set(max.control, axis?.max);
		set(majorUnit.control, axis?.majorUnit);
		displayUnits.control.value = axis?.displayUnits ?? '';
		logScale.control.checked = axis?.logScale ?? false;
		reverse.control.checked = axis?.orientation === 'maxMin';
		gridlines.control.checked = axis?.majorGridlines ?? false;
		const item = data.series[seriesIndex()];
		trendline.control.value = item?.trendlines?.[0]?.trendlineType ?? '';
		equation.control.checked = item?.trendlines?.[0]?.displayEq ?? false;
		rSquared.control.checked = item?.trendlines?.[0]?.displayRSq ?? false;
		errorType.control.value = item?.errBars?.[0]?.valType ?? '';
		set(errorAmount.control, item?.errBars?.[0]?.val);
		marker.control.value = item?.marker?.symbol ?? 'none';
		set(markerSize.control, item?.marker?.size);
		seriesColor.control.value = item?.color ?? '#4472c4';
		const point = item?.dataPoints?.find(({ idx }) => idx === pointIndex.selected());
		pointColor.control.value = point?.spPr?.fillColor ?? item?.color ?? '#4472c4';
		set(pointExplosion.control, point?.explosion);
	};
	return { el, update: sync };
}
