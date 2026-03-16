import type {
	PptxElement,
	ChartPptxElement,
	PptxChartData,
	PptxChartSeries,
	PptxChartStyle,
	PptxChartType,
} from 'pptx-viewer-core';
import {
	chartDataAddSeries,
	chartDataRemoveSeries,
	chartDataUpdatePoint,
	chartDataChangeType,
	chartDataAddCategory,
	chartDataRemoveCategory,
} from 'pptx-viewer-core';
import { useCallback } from 'react';

import { ChartDataGrid } from './ChartDataGrid';
import { ChartDisplayOptions } from './ChartDisplayOptions';
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

			<ChartDataGrid
				categories={categories}
				series={series}
				canEdit={canEdit}
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
