/**
 * useChartEditing: the framework-thin wiring layer for Vue's advanced chart
 * inspector. It owns the clone-mutate-emit plumbing so the `ChartPanel.vue`
 * subcomponents stay pure presentation.
 *
 * Every mutation funnels through one of two paths:
 *  - `replaceChartData` / `patchChartData` for plain shallow patches and the
 *    smart `chartDataChangeType` path, and
 *  - `applyChartOp`, which deep-clones the chart data and runs an in-place
 *    `pptx-viewer-core` SDK op against the clone so the live element is never
 *    mutated (Vue sees a fresh reference and history stays clean).
 *
 * The returned helpers all emit a SHALLOW `{ chartData }` patch via the
 * supplied `emitUpdate`, matching the inspector-panel `update` contract.
 */
import type {
	ChartPptxElement,
	PptxChartAxisFormatting,
	PptxChartData,
	PptxChartErrBars,
	PptxChartMarkerSymbol,
	PptxChartSeries,
	PptxChartStyle,
	PptxChartTrendline,
	PptxChartType,
} from 'pptx-viewer-core';
import {
	chartDataAddCategory,
	chartDataAddSeries,
	chartDataRemoveCategory,
	chartDataRemoveSeries,
	chartDataUpdatePoint,
	setChartAxisGridlineStyle,
	setChartAxisLogScale,
	setChartAxisTitleStyle,
	setChartDataPointExplosion,
	setChartDataPointFill,
	setChartDataPointLabel,
	setChartDataPointMarker,
	setChartSeriesChartType,
	setChartSeriesMarker,
} from 'pptx-viewer-core';
import { patchChartData as sharedPatchChartData } from 'pptx-viewer-shared';
import type { ComputedRef } from 'vue';
import { toRaw } from 'vue';

import { useSafeTranslate } from './useSafeTranslate';

/** Edit shape for axis-title font styling (matches the core op). */
export interface ChartAxisTitleStyleEdit {
	fontFamily?: string | null;
	fontSize?: number | null;
	fontBold?: boolean;
	fontColor?: string | null;
}

/** Edit shape for gridline line styling (matches the core op). */
export interface ChartGridlineStyleEdit {
	color?: string | null;
	width?: number | null;
	dashStyle?: string | null;
}

/** Patch shape for a series marker (subset accepted by the core op). */
export interface ChartMarkerEdit {
	symbol?: PptxChartMarkerSymbol;
	size?: number;
	fillColor?: string;
}

/** The mutation helpers a chart inspector needs. */
export interface ChartEditing {
	patchChartData: (patch: Partial<PptxChartData>) => void;
	updateStyle: (patch: Partial<PptxChartStyle>) => void;
	updateAxis: (
		axisType: PptxChartAxisFormatting['axisType'],
		patch: Partial<PptxChartAxisFormatting>,
	) => void;
	setSeriesColor: (index: number, color: string | null) => void;
	setSeriesTrendline: (index: number, trendline: PptxChartTrendline | null) => void;
	setSeriesErrorBars: (index: number, errBars: PptxChartErrBars | null) => void;
	setAxisLogScale: (
		axisType: PptxChartAxisFormatting['axisType'],
		opts: { enabled: boolean; base?: number },
	) => void;
	setAxisTitleStyle: (
		axisType: PptxChartAxisFormatting['axisType'],
		edit: ChartAxisTitleStyleEdit,
	) => void;
	setGridlineStyle: (
		axisType: PptxChartAxisFormatting['axisType'],
		which: 'major' | 'minor',
		edit: ChartGridlineStyleEdit,
	) => void;
	setSeriesMarker: (index: number, marker: ChartMarkerEdit | null) => void;
	setSeriesType: (index: number, seriesType: PptxChartType | null) => void;
	setPointFill: (seriesIndex: number, pointIndex: number, color: string | null) => void;
	setPointExplosion: (seriesIndex: number, pointIndex: number, explosion: number | null) => void;
	setPointMarker: (seriesIndex: number, pointIndex: number, marker: ChartMarkerEdit | null) => void;
	setPointLabel: (seriesIndex: number, pointIndex: number, text: string | null) => void;
	/** Patch a single series (e.g. rename) in place, preserving the rest. */
	updateSeries: (index: number, patch: Partial<PptxChartSeries>) => void;
	/** Rename one category label. */
	updateCategoryLabel: (catIndex: number, value: string) => void;
	/** Set one numeric value from a raw input string (ignored if not finite). */
	updateValue: (seriesIndex: number, catIndex: number, raw: string) => void;
	/** Append an empty series/category, or remove one by index. */
	addSeries: () => void;
	removeSeries: (seriesIndex: number) => void;
	addCategory: () => void;
	removeCategory: (catIndex: number) => void;
}

/**
 * Build the chart-editing helper bundle.
 *
 * @param element    reactive accessor for the selected chart element (or null).
 * @param chartData  reactive accessor for that element's chart data (or null).
 * @param emitUpdate emits the shallow `{ chartData }` patch up to the host.
 */
export function useChartEditing(
	element: ComputedRef<ChartPptxElement | null>,
	chartData: ComputedRef<PptxChartData | null>,
	emitUpdate: (next: PptxChartData) => void,
): ChartEditing {
	const t = useSafeTranslate();
	const replaceChartData = (next: PptxChartData): void => emitUpdate(next);

	const patchChartData = (patch: Partial<PptxChartData>): void => {
		const data = chartData.value;
		if (!data) {
			return;
		}
		replaceChartData(sharedPatchChartData(data, patch));
	};

	const updateStyle = (patch: Partial<PptxChartStyle>): void => {
		const data = chartData.value;
		if (!data) {
			return;
		}
		replaceChartData({ ...data, style: { ...data.style, ...patch } });
	};

	const updateAxis = (
		axisType: PptxChartAxisFormatting['axisType'],
		patch: Partial<PptxChartAxisFormatting>,
	): void => {
		const data = chartData.value;
		if (!data) {
			return;
		}
		const axes = data.axes ? [...data.axes] : [];
		const index = axes.findIndex((a) => a.axisType === axisType);
		if (index === -1) {
			axes.push({ axisType, ...patch });
		} else {
			axes[index] = { ...axes[index], ...patch };
		}
		patchChartData({ axes });
	};

	const updateSeries = (index: number, patch: Partial<PptxChartSeries>): void => {
		const data = chartData.value;
		if (!data) {
			return;
		}
		const series = data.series.map((s, i) => (i === index ? { ...s, ...patch } : s));
		patchChartData({ series });
	};

	const setSeriesColor = (index: number, color: string | null): void =>
		updateSeries(index, { color: color ?? undefined });

	const updateCategoryLabel = (catIndex: number, value: string): void => {
		const data = chartData.value;
		if (!data) {
			return;
		}
		patchChartData({ categories: data.categories.map((c, i) => (i === catIndex ? value : c)) });
	};

	const updateValue = (seriesIndex: number, catIndex: number, raw: string): void => {
		const data = chartData.value;
		if (!data) {
			return;
		}
		const num = Number.parseFloat(raw);
		if (!Number.isFinite(num)) {
			return;
		}
		replaceChartData(chartDataUpdatePoint(data, seriesIndex, catIndex, num));
	};

	const addCategory = (): void => {
		const data = chartData.value;
		if (!data) {
			return;
		}
		replaceChartData(chartDataAddCategory(data, `Cat ${data.categories.length + 1}`));
	};

	const removeCategory = (catIndex: number): void => {
		const data = chartData.value;
		if (!data || data.categories.length <= 1) {
			return;
		}
		replaceChartData(chartDataRemoveCategory(data, catIndex));
	};

	const addSeries = (): void => {
		const data = chartData.value;
		if (!data) {
			return;
		}
		replaceChartData(
			chartDataAddSeries(data, {
				name: t('pptx.chart.seriesDefaultName', { number: data.series.length + 1 }),
				values: data.categories.map(() => 0),
			}),
		);
	};

	const removeSeries = (seriesIndex: number): void => {
		const data = chartData.value;
		if (!data || data.series.length <= 1) {
			return;
		}
		replaceChartData(chartDataRemoveSeries(data, seriesIndex));
	};

	const setSeriesTrendline = (index: number, trendline: PptxChartTrendline | null): void =>
		updateSeries(index, { trendlines: trendline ? [trendline] : [] });

	const setSeriesErrorBars = (index: number, errBars: PptxChartErrBars | null): void =>
		updateSeries(index, { errBars: errBars ? [errBars] : [] });

	/** Deep-clone the chart data, run an in-place core op against it, emit. */
	const applyChartOp = (mutate: (el: ChartPptxElement) => void): void => {
		const el = element.value;
		const data = chartData.value;
		if (!el || !data) {
			return;
		}
		// `toRaw` strips Vue's reactive Proxy so `structuredClone` (which cannot
		// clone a Proxy) sees a plain object; the op then mutates the clone only.
		const clone: ChartPptxElement = { ...toRaw(el), chartData: structuredClone(toRaw(data)) };
		mutate(clone);
		if (clone.chartData) {
			replaceChartData(clone.chartData);
		}
	};

	return {
		patchChartData,
		updateStyle,
		updateAxis,
		setSeriesColor,
		setSeriesTrendline,
		setSeriesErrorBars,
		setAxisLogScale: (axisType, opts) =>
			applyChartOp((el) => setChartAxisLogScale(el, axisType, opts)),
		setAxisTitleStyle: (axisType, edit) =>
			applyChartOp((el) => setChartAxisTitleStyle(el, axisType, edit)),
		setGridlineStyle: (axisType, which, edit) =>
			applyChartOp((el) => setChartAxisGridlineStyle(el, axisType, which, edit)),
		setSeriesMarker: (index, marker) =>
			applyChartOp((el) => setChartSeriesMarker(el, index, marker)),
		setSeriesType: (index, seriesType) =>
			applyChartOp((el) => setChartSeriesChartType(el, index, seriesType)),
		setPointFill: (seriesIndex, pointIndex, color) =>
			applyChartOp((el) => setChartDataPointFill(el, seriesIndex, pointIndex, color)),
		setPointExplosion: (seriesIndex, pointIndex, explosion) =>
			applyChartOp((el) => setChartDataPointExplosion(el, seriesIndex, pointIndex, explosion)),
		setPointMarker: (seriesIndex, pointIndex, marker) =>
			applyChartOp((el) => setChartDataPointMarker(el, seriesIndex, pointIndex, marker)),
		setPointLabel: (seriesIndex, pointIndex, text) =>
			applyChartOp((el) =>
				setChartDataPointLabel(el, seriesIndex, pointIndex, text !== null ? { text } : null),
			),
		updateSeries,
		updateCategoryLabel,
		updateValue,
		addSeries,
		removeSeries,
		addCategory,
		removeCategory,
	};
}
