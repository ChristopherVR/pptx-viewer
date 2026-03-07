import { useTranslation } from "react-i18next";
import { LuPlus, LuTrash2 } from "react-icons/lu";

import type { PptxChartSeries } from "pptx-viewer-core";
import { CELL_INPUT, BTN, HEADING, CARD } from "./chart-panel-constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChartDataGridProps {
  series: PptxChartSeries[];
  categories: string[];
  canEdit: boolean;
  onUpdateSeries: (index: number, patch: Partial<PptxChartSeries>) => void;
  onUpdateCategoryLabel: (catIndex: number, value: string) => void;
  onUpdateValue: (seriesIndex: number, catIndex: number, raw: string) => void;
  onAddCategory: () => void;
  onRemoveCategory: (catIndex: number) => void;
  onAddSeries: () => void;
  onRemoveSeries: (seriesIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChartDataGrid({
  series,
  categories,
  canEdit,
  onUpdateSeries,
  onUpdateCategoryLabel,
  onUpdateValue,
  onAddCategory,
  onRemoveCategory,
  onAddSeries,
  onRemoveSeries,
}: ChartDataGridProps) {
  const { t } = useTranslation();

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <div className={HEADING}>{t("pptx.chart.data")}</div>
        {canEdit && (
          <div className="flex gap-1">
            <button
              type="button"
              className={BTN}
              title={t("pptx.chart.addCategory")}
              onClick={onAddCategory}
            >
              <LuPlus className="inline w-3 h-3 mr-0.5" />
              {t("pptx.chart.cat")}
            </button>
            <button
              type="button"
              className={BTN}
              title={t("pptx.chart.addSeries")}
              onClick={onAddSeries}
            >
              <LuPlus className="inline w-3 h-3 mr-0.5" />
              {t("pptx.chart.seriesShort")}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr>
              <th className="text-muted-foreground p-0.5 text-left min-w-[60px]" />
              {series.map((s, si) => (
                <th key={si} className="p-0.5 font-normal min-w-[72px]">
                  <div className="flex items-center gap-0.5">
                    <input
                      type="text"
                      disabled={!canEdit}
                      className={CELL_INPUT}
                      value={s.name}
                      onChange={(e) =>
                        onUpdateSeries(si, { name: e.target.value })
                      }
                    />
                    {canEdit && series.length > 1 && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-red-400 shrink-0"
                        title={t("pptx.chart.removeSeries")}
                        onClick={() => onRemoveSeries(si)}
                      >
                        <LuTrash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, ci) => (
              <tr key={ci}>
                <td className="p-0.5">
                  <div className="flex items-center gap-0.5">
                    <input
                      type="text"
                      disabled={!canEdit}
                      className={CELL_INPUT}
                      value={cat}
                      onChange={(e) =>
                        onUpdateCategoryLabel(ci, e.target.value)
                      }
                    />
                    {canEdit && categories.length > 1 && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-red-400 shrink-0"
                        title={t("pptx.chart.removeCategory")}
                        onClick={() => onRemoveCategory(ci)}
                      >
                        <LuTrash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
                {series.map((s, si) => (
                  <td key={si} className="p-0.5">
                    <input
                      type="number"
                      disabled={!canEdit}
                      className={CELL_INPUT}
                      value={s.values[ci] ?? 0}
                      onChange={(e) => onUpdateValue(si, ci, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
