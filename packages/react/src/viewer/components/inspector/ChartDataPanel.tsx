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
import {
	addChartCategory,
	addChartSeries,
	chartGridlinesPatch,
	chartGridlinesState,
	patchChartData,
	removeChartCategory,
	removeChartSeries,
	seriesSecondaryAxisPatch,
	setChartCategoryLabel,
	setChartCellValue,
} from 'pptx-viewer-shared';
import { useCallback } from 'react';

import { useChartPartSelection } from '../chart-part-selection';
import { useViewerOptionsContext } from '../viewer-options-context';
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
import { ChartSubtypeOptions } from './ChartSubtypeOptions';
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
	// File > Options > Advanced > "Properties follow chart data point for
	// current workbook": whether per-point manual formatting re-indexes with
	// the underlying data (default) or stays pinned to its old position.
	const followDataPoint = useViewerOptionsContext().advanced.chartPropertiesFollowDataPoint;
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
			replaceChartData(patchChartData(chartData, patch));
		},
		[chartData, replaceChartData],
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

	const hasGridlines = chartData ? chartGridlinesState(chartData) : false;
	const toggleGridlines = useCallback(
		(show: boolean) => {
			if (!chartData) {
				return;
			}
			updateChartData(chartGridlinesPatch(chartData, show));
		},
		[chartData, updateChartData],
	);

	const toggleSecondaryAxis = useCallback(
		(seriesIndex: number, useSecondary: boolean) => {
			if (!chartData) {
				return;
			}
			updateChartData(seriesSecondaryAxisPatch(chartData, seriesIndex, useSecondary));
		},
		[chartData, updateChartData],
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

	// ── Data-grid edits ─────────────────────────────────────────
	// The guards (auto-naming, keep-at-least-one, reject non-numeric cells) live
	// in `pptx-viewer-shared`'s `chart-data-grid-ops` so every binding's grid
	// behaves identically; `null` means the edit must not be applied.
	const updateCategoryLabel = useCallback(
		(catIndex: number, value: string) => {
			const next = chartData && setChartCategoryLabel(chartData, catIndex, value);
			if (next) {
				replaceChartData(next);
			}
		},
		[chartData, replaceChartData],
	);

	const updateValue = useCallback(
		(seriesIndex: number, catIndex: number, raw: string) => {
			const next = chartData && setChartCellValue(chartData, seriesIndex, catIndex, raw);
			if (next) {
				replaceChartData(next);
			}
		},
		[chartData, replaceChartData],
	);

	// ── Add / Remove helpers ────────────────────────────────────
	const addCategory = useCallback(() => {
		if (chartData) {
			replaceChartData(addChartCategory(chartData));
		}
	}, [chartData, replaceChartData]);

	const removeCategory = useCallback(
		(catIndex: number) => {
			const next = chartData && removeChartCategory(chartData, catIndex, followDataPoint);
			if (next) {
				replaceChartData(next);
			}
		},
		[chartData, followDataPoint, replaceChartData],
	);

	const addSeries = useCallback(() => {
		if (chartData) {
			replaceChartData(addChartSeries(chartData));
		}
	}, [chartData, replaceChartData]);

	const removeSeries = useCallback(
		(seriesIndex: number) => {
			const next = chartData && removeChartSeries(chartData, seriesIndex);
			if (next) {
				replaceChartData(next);
			}
		},
		[chartData, replaceChartData],
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

			<ChartDisplayOptions
				style={style}
				canEdit={canEdit}
				onUpdateStyle={updateStyle}
				hasGridlines={hasGridlines}
				onToggleGridlines={toggleGridlines}
			/>

			<ChartSubtypeOptions
				chartData={chartData}
				canEdit={canEdit}
				onUpdateChartData={updateChartData}
			/>

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
			<ChartSeriesColorOptions
				chartData={chartData}
				canEdit={canEdit}
				onSetColor={setSeriesColor}
				onToggleSecondaryAxis={toggleSecondaryAxis}
			/>

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
