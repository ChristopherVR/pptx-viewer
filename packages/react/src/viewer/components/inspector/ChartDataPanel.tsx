import type {
	PptxElement,
	ChartPptxElement,
	PptxChartAxisFormatting,
	PptxChartData,
	PptxChartMarkerSymbol,
	PptxChartSeries,
	PptxChartErrBars,
	PptxChartStyle,
	PptxChartTrendline,
	PptxChartType,
} from 'pptx-viewer-core';
import {
	chartDataAddSeries,
	chartDataRemoveSeries,
	chartDataUpdatePoint,
	chartDataChangeType,
	chartDataAddCategory,
	chartDataRemoveCategory,
	setChartAxisLogScale,
	setChartAxisTitleStyle,
	setChartAxisGridlineStyle,
	setChartSeriesMarker,
	setChartSeriesChartType,
	setChartDataPointFill,
	setChartDataPointExplosion,
	setChartDataPointMarker,
	setChartDataPointLabel,
} from 'pptx-viewer-core';
import { useCallback } from 'react';

import { useChartPartSelection } from '../chart-part-selection';
import { ChartAxisOptions } from './ChartAxisOptions';
import { ChartAxisStyleOptions } from './ChartAxisStyleOptions';
import { ChartComboTypeOptions } from './ChartComboTypeOptions';
import { ChartDataGrid } from './ChartDataGrid';
import { ChartDataLabelOptions } from './ChartDataLabelOptions';
import { ChartDataPointMarkerOptions } from './ChartDataPointMarkerOptions';
import { ChartDataPointOptions } from './ChartDataPointOptions';
import { ChartDisplayOptions } from './ChartDisplayOptions';
import { ChartErrorBarOptions } from './ChartErrorBarOptions';
import { ChartMarkerOptions } from './ChartMarkerOptions';
import { ChartSeriesColorOptions } from './ChartSeriesColorOptions';
import { ChartTrendlineOptions } from './ChartTrendlineOptions';
import { ChartTypeSelector } from './ChartTypeSelector';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartDataPanelProps {
	selectedElement: ChartPptxElement;
	canEdit: boolean;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartDataPanel({ selectedElement, canEdit, onUpdateElement }: ChartDataPanelProps) {
	const chartData = selectedElement.chartData;
	// Part selected by clicking a mark on the canvas chart, if it is this chart's.
	const { selection: partSelection } = useChartPartSelection();
	const canvasPart = partSelection?.elementId === selectedElement.id ? partSelection.part : null;
	const title = chartData?.title;
	const chartType = chartData?.chartType;
	const categories = chartData?.categories;
	const series = chartData?.series;
	const style = chartData?.style;
	const grouping = chartData?.grouping;

	// ── Helpers ──────────────────────────────────────────────────

	/** Push a complete new `PptxChartData` through the update pipeline. */
	const replaceChartData = useCallback(
		(newData: PptxChartData) => {
			onUpdateElement({
				chartData: newData,
			} as Partial<PptxElement>);
		},
		[onUpdateElement],
	);

	const updateChartData = useCallback(
		(patch: Partial<PptxChartData>) => {
			if (!chartData) {
				return;
			}
			// For chart type changes, use the smart utility that handles
			// grouping cleanup and category format adaptation.
			if (patch.chartType && patch.chartType !== chartData.chartType) {
				const adapted = chartDataChangeType(chartData, patch.chartType as PptxChartType);
				// Merge any other fields from the patch (e.g. title changes)
				const { chartType: _ct, ...rest } = patch;
				replaceChartData({ ...adapted, ...rest });
				return;
			}
			onUpdateElement({
				chartData: { ...chartData, ...patch },
			} as Partial<PptxElement>);
		},
		[chartData, onUpdateElement, replaceChartData],
	);

	const updateStyle = useCallback(
		(patch: Partial<PptxChartStyle>) => {
			if (!chartData) {
				return;
			}
			onUpdateElement({
				chartData: {
					...chartData,
					style: { ...style, ...patch },
				},
			} as Partial<PptxElement>);
		},
		[chartData, style, onUpdateElement],
	);

	const updateAxis = useCallback(
		(axisType: PptxChartAxisFormatting['axisType'], patch: Partial<PptxChartAxisFormatting>) => {
			if (!chartData) {
				return;
			}
			const axes = chartData.axes ? [...chartData.axes] : [];
			const index = axes.findIndex((a) => a.axisType === axisType);
			if (index === -1) {
				axes.push({ axisType, ...patch });
			} else {
				axes[index] = { ...axes[index], ...patch };
			}
			updateChartData({ axes });
		},
		[chartData, updateChartData],
	);

	const updateSeries = useCallback(
		(index: number, patch: Partial<PptxChartSeries>) => {
			if (!series) {
				return;
			}
			const updated = series.map((s, i) => (i === index ? { ...s, ...patch } : s));
			updateChartData({ series: updated });
		},
		[series, updateChartData],
	);

	const setSeriesTrendline = useCallback(
		(index: number, trendline: PptxChartTrendline | null) => {
			if (!series) {
				return;
			}
			const updated = series.map((s, i) =>
				i === index ? { ...s, trendlines: trendline ? [trendline] : [] } : s,
			);
			updateChartData({ series: updated });
		},
		[series, updateChartData],
	);

	const setSeriesErrorBars = useCallback(
		(index: number, errBars: PptxChartErrBars | null) => {
			if (!series) {
				return;
			}
			const updated = series.map((s, i) =>
				i === index ? { ...s, errBars: errBars ? [errBars] : [] } : s,
			);
			updateChartData({ series: updated });
		},
		[series, updateChartData],
	);

	// ── Chart series colour (delimited block; keep merge-friendly) ──
	const setSeriesColor = useCallback(
		(index: number, color: string | null) => {
			updateSeries(index, { color: color ?? undefined });
		},
		[updateSeries],
	);

	const updateCategoryLabel = useCallback(
		(catIndex: number, value: string) => {
			if (!categories) {
				return;
			}
			const updated = categories.map((c, i) => (i === catIndex ? value : c));
			updateChartData({ categories: updated });
		},
		[categories, updateChartData],
	);

	const updateValue = useCallback(
		(seriesIndex: number, catIndex: number, raw: string) => {
			if (!chartData) {
				return;
			}
			const num = Number.parseFloat(raw);
			if (!Number.isFinite(num)) {
				return;
			}
			replaceChartData(chartDataUpdatePoint(chartData, seriesIndex, catIndex, num));
		},
		[chartData, replaceChartData],
	);

	// ── Add / Remove helpers ────────────────────────────────────
	const addCategory = useCallback(() => {
		if (!chartData || !categories) {
			return;
		}
		replaceChartData(chartDataAddCategory(chartData, `Cat ${categories.length + 1}`));
	}, [chartData, categories, replaceChartData]);

	const removeCategory = useCallback(
		(catIndex: number) => {
			if (!chartData || !categories || categories.length <= 1) {
				return;
			}
			replaceChartData(chartDataRemoveCategory(chartData, catIndex));
		},
		[chartData, categories, replaceChartData],
	);

	const addSeries = useCallback(() => {
		if (!chartData || !categories || !series) {
			return;
		}
		replaceChartData(
			chartDataAddSeries(chartData, {
				name: `Series ${series.length + 1}`,
				values: categories.map(() => 0),
			}),
		);
	}, [chartData, categories, series, replaceChartData]);

	const removeSeries = useCallback(
		(seriesIndex: number) => {
			if (!chartData || !series || series.length <= 1) {
				return;
			}
			replaceChartData(chartDataRemoveSeries(chartData, seriesIndex));
		},
		[chartData, series, replaceChartData],
	);

	// ── SDK-op helpers (clone, mutate via core op, emit) ────────
	// The headless chart ops mutate in place; run them against a deep clone of
	// the chart data so React sees a fresh reference and history stays clean.
	const applyChartOp = useCallback(
		(mutate: (el: ChartPptxElement) => void) => {
			if (!chartData) {
				return;
			}
			const clone: ChartPptxElement = {
				...selectedElement,
				chartData: structuredClone(chartData),
			};
			mutate(clone);
			replaceChartData(clone.chartData!);
		},
		[chartData, selectedElement, replaceChartData],
	);

	const setAxisLogScale = useCallback(
		(axisType: PptxChartAxisFormatting['axisType'], opts: { enabled: boolean; base?: number }) =>
			applyChartOp((el) => setChartAxisLogScale(el, axisType, opts)),
		[applyChartOp],
	);

	const setAxisTitleStyle = useCallback(
		(
			axisType: PptxChartAxisFormatting['axisType'],
			edit: {
				fontFamily?: string | null;
				fontSize?: number | null;
				fontBold?: boolean;
				fontColor?: string | null;
			},
		) => applyChartOp((el) => setChartAxisTitleStyle(el, axisType, edit)),
		[applyChartOp],
	);

	const setGridlineStyle = useCallback(
		(
			axisType: PptxChartAxisFormatting['axisType'],
			which: 'major' | 'minor',
			edit: { color?: string | null; width?: number | null; dashStyle?: string | null },
		) => applyChartOp((el) => setChartAxisGridlineStyle(el, axisType, which, edit)),
		[applyChartOp],
	);

	const setSeriesMarker = useCallback(
		(
			index: number,
			marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
		) => applyChartOp((el) => setChartSeriesMarker(el, index, marker)),
		[applyChartOp],
	);

	const setSeriesType = useCallback(
		(index: number, seriesType: PptxChartType | null) =>
			applyChartOp((el) => setChartSeriesChartType(el, index, seriesType)),
		[applyChartOp],
	);

	const setPointFill = useCallback(
		(seriesIndex: number, pointIndex: number, color: string | null) =>
			applyChartOp((el) => setChartDataPointFill(el, seriesIndex, pointIndex, color)),
		[applyChartOp],
	);

	const setPointExplosion = useCallback(
		(seriesIndex: number, pointIndex: number, explosion: number | null) =>
			applyChartOp((el) => setChartDataPointExplosion(el, seriesIndex, pointIndex, explosion)),
		[applyChartOp],
	);

	const setPointMarker = useCallback(
		(
			seriesIndex: number,
			pointIndex: number,
			marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
		) => applyChartOp((el) => setChartDataPointMarker(el, seriesIndex, pointIndex, marker)),
		[applyChartOp],
	);

	const setPointLabel = useCallback(
		(seriesIndex: number, pointIndex: number, text: string | null) =>
			applyChartOp((el) =>
				setChartDataPointLabel(el, seriesIndex, pointIndex, text !== null ? { text } : null),
			),
		[applyChartOp],
	);

	// ── Render ──────────────────────────────────────────────────
	if (!chartData || !categories || !series) {
		return null;
	}

	return (
		<>
			<ChartTypeSelector
				title={title}
				chartType={chartType!}
				grouping={grouping}
				seriesCount={series.length}
				categoryCount={categories.length}
				canEdit={canEdit}
				onUpdateChartData={updateChartData}
			/>

			<ChartDisplayOptions style={style} canEdit={canEdit} onUpdateStyle={updateStyle} />

			<ChartDataLabelOptions style={style} canEdit={canEdit} onUpdateStyle={updateStyle} />

			<ChartAxisOptions axes={chartData.axes} canEdit={canEdit} onUpdateAxis={updateAxis} />

			{/* ── Axis styling: log scale, title font, gridline lines ── */}
			<ChartAxisStyleOptions
				axes={chartData.axes}
				canEdit={canEdit}
				onSetLogScale={setAxisLogScale}
				onSetTitleStyle={setAxisTitleStyle}
				onSetGridlineStyle={setGridlineStyle}
			/>

			{/* ── Per-series markers (line/scatter/bubble/radar) ── */}
			<ChartMarkerOptions
				chartType={chartType!}
				series={series}
				canEdit={canEdit}
				onSetMarker={setSeriesMarker}
			/>

			{/* ── Per-series combo chart types ── */}
			<ChartComboTypeOptions
				chartType={chartType!}
				series={series}
				canEdit={canEdit}
				onSetSeriesType={setSeriesType}
			/>

			{/* ── Per-data-point formatting (label text + fill + pie explosion) ── */}
			<ChartDataPointOptions
				chartType={chartType!}
				categories={categories}
				series={series}
				canEdit={canEdit}
				onSetPointFill={setPointFill}
				onSetPointExplosion={setPointExplosion}
				onSetPointLabel={setPointLabel}
			/>

			{/* ── Per-data-point marker overrides (line/scatter/bubble/radar) ── */}
			<ChartDataPointMarkerOptions
				chartType={chartType!}
				categories={categories}
				series={series}
				canEdit={canEdit}
				onSetPointMarker={setPointMarker}
			/>

			<ChartTrendlineOptions
				chartType={chartType!}
				series={series}
				canEdit={canEdit}
				onSetTrendline={setSeriesTrendline}
			/>

			<ChartErrorBarOptions
				chartType={chartType!}
				series={series}
				canEdit={canEdit}
				onSetErrorBars={setSeriesErrorBars}
			/>

			{/* ── Series colour picker (delimited block; keep merge-friendly) ── */}
			<ChartSeriesColorOptions series={series} canEdit={canEdit} onSetColor={setSeriesColor} />

			<ChartDataGrid
				categories={categories}
				series={series}
				canEdit={canEdit}
				highlightCell={
					canvasPart
						? { seriesIndex: canvasPart.seriesIndex, pointIndex: canvasPart.pointIndex }
						: null
				}
				onUpdateSeries={updateSeries}
				onUpdateCategoryLabel={updateCategoryLabel}
				onUpdateValue={updateValue}
				onAddCategory={addCategory}
				onRemoveCategory={removeCategory}
				onAddSeries={addSeries}
				onRemoveSeries={removeSeries}
			/>
		</>
	);
}
