import { useCallback } from "react";

import type {
  PptxElement,
  ChartPptxElement,
  PptxChartData,
  PptxChartSeries,
  PptxChartStyle,
} from "../../../core";
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
  const updateChartData = useCallback(
    (patch: Partial<PptxChartData>) => {
      onUpdateElement({
        chartData: { ...chartData, ...patch },
      } as Partial<PptxElement>);
    },
    [chartData, onUpdateElement],
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
      const updated = series.map((s, si) => {
        if (si !== seriesIndex) return s;
        const vals = [...s.values];
        vals[catIndex] = num;
        return { ...s, values: vals };
      });
      updateChartData({ series: updated });
    },
    [series, updateChartData],
  );

  // ── Add / Remove helpers ────────────────────────────────────
  const addCategory = useCallback(() => {
    const newCats = [...categories, `Cat ${categories.length + 1}`];
    const newSeries = series.map((s) => ({
      ...s,
      values: [...s.values, 0],
    }));
    updateChartData({ categories: newCats, series: newSeries });
  }, [categories, series, updateChartData]);

  const removeCategory = useCallback(
    (catIndex: number) => {
      if (categories.length <= 1) return;
      const newCats = categories.filter((_, i) => i !== catIndex);
      const newSeries = series.map((s) => ({
        ...s,
        values: s.values.filter((_, i) => i !== catIndex),
      }));
      updateChartData({ categories: newCats, series: newSeries });
    },
    [categories, series, updateChartData],
  );

  const addSeries = useCallback(() => {
    const newSeries: PptxChartSeries = {
      name: `Series ${series.length + 1}`,
      values: categories.map(() => 0),
    };
    updateChartData({ series: [...series, newSeries] });
  }, [categories, series, updateChartData]);

  const removeSeries = useCallback(
    (seriesIndex: number) => {
      if (series.length <= 1) return;
      updateChartData({
        series: series.filter((_, i) => i !== seriesIndex),
      });
    },
    [series, updateChartData],
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
