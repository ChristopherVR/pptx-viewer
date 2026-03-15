import { useCallback } from "react";

import type {
  PptxElement,
  ChartPptxElement,
  PptxChartData,
  PptxChartSeries,
  PptxChartStyle,
  PptxChartType,
} from "pptx-viewer-core";
import {
  chartDataAddSeries,
  chartDataRemoveSeries,
  chartDataUpdatePoint,
  chartDataChangeType,
  chartDataAddCategory,
  chartDataRemoveCategory,
} from "pptx-viewer-core";
import { ChartDataGrid } from "./ChartDataGrid";
import { ChartDisplayOptions } from "./ChartDisplayOptions";
import { ChartTypeSelector } from "./ChartTypeSelector";

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
export function ChartDataPanel({
  selectedElement,
  canEdit,
  onUpdateElement,
}: ChartDataPanelProps) {
  const chartData = selectedElement.chartData;
  if (!chartData) return null;

  const { title, chartType, categories, series, style, grouping } = chartData;

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
      const updated = series.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      );
      updateChartData({ series: updated });
    },
    [series, updateChartData],
  );

  const updateCategoryLabel = useCallback(
    (catIndex: number, value: string) => {
      const updated = categories.map((c, i) => (i === catIndex ? value : c));
      updateChartData({ categories: updated });
    },
    [categories, updateChartData],
  );

  const updateValue = useCallback(
    (seriesIndex: number, catIndex: number, raw: string) => {
      const num = Number.parseFloat(raw);
      if (!Number.isFinite(num)) return;
      replaceChartData(chartDataUpdatePoint(chartData, seriesIndex, catIndex, num));
    },
    [chartData, replaceChartData],
  );

  // ── Add / Remove helpers ────────────────────────────────────
  const addCategory = useCallback(() => {
    replaceChartData(
      chartDataAddCategory(chartData, `Cat ${categories.length + 1}`),
    );
  }, [chartData, categories.length, replaceChartData]);

  const removeCategory = useCallback(
    (catIndex: number) => {
      if (categories.length <= 1) return;
      replaceChartData(chartDataRemoveCategory(chartData, catIndex));
    },
    [chartData, categories.length, replaceChartData],
  );

  const addSeries = useCallback(() => {
    replaceChartData(
      chartDataAddSeries(chartData, {
        name: `Series ${series.length + 1}`,
        values: categories.map(() => 0),
      }),
    );
  }, [chartData, categories, series.length, replaceChartData]);

  const removeSeries = useCallback(
    (seriesIndex: number) => {
      if (series.length <= 1) return;
      replaceChartData(chartDataRemoveSeries(chartData, seriesIndex));
    },
    [chartData, series.length, replaceChartData],
  );

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      <ChartTypeSelector
        title={title}
        chartType={chartType}
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
      />

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
