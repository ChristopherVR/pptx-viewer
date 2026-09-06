/**
 * useChartOpEditing: the "SDK-op" slice of Vue's advanced chart inspector
 * wiring, split out of `useChartEditing.ts` to keep that file under the
 * repo's 300-LOC guideline. Every helper here deep-clones the chart data and
 * runs an in-place `pptx-viewer-core` SDK op against the clone (so the live
 * element is never mutated and Vue sees a fresh reference), then emits it via
 * `replaceChartData`. `useChartEditing` composes this in and spreads its
 * return value into the combined `ChartEditing` bundle.
 */
import type {
	ChartPptxElement,
	PptxChartAxisFormatting,
	PptxChartData,
	PptxChartMarkerSymbol,
	PptxChartType,
} from 'pptx-viewer-core';
import {
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
import type { ComputedRef } from 'vue';
import { toRaw } from 'vue';

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

/** The SDK-op mutation helpers a chart inspector needs. */
export interface ChartOpEditing {
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
}

/**
 * Build the SDK-op helper bundle.
 *
 * @param element         reactive accessor for the selected chart element (or null).
 * @param chartData       reactive accessor for that element's chart data (or null).
 * @param replaceChartData emits a full new `PptxChartData` up to the host.
 */
export function useChartOpEditing(
	element: ComputedRef<ChartPptxElement | null>,
	chartData: ComputedRef<PptxChartData | null>,
	replaceChartData: (next: PptxChartData) => void,
): ChartOpEditing {
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
	};
}
