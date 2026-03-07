import { useTranslation } from "react-i18next";

import type { PptxChartData, PptxChartType } from "pptx-viewer-core";
import {
  CARD,
  CHART_TYPE_OPTIONS,
  GROUPING_OPTIONS,
  GROUPING_SUPPORTED_TYPES,
  HEADING,
  INPUT,
} from "./chart-panel-constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartTypeSelectorProps {
  title: string | undefined;
  chartType: PptxChartType;
  grouping: PptxChartData["grouping"] | undefined;
  seriesCount: number;
  categoryCount: number;
  canEdit: boolean;
  onUpdateChartData: (patch: Partial<PptxChartData>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartTypeSelector({
  title,
  chartType,
  grouping,
  seriesCount,
  categoryCount,
  canEdit,
  onUpdateChartData,
}: ChartTypeSelectorProps) {
  const { t } = useTranslation();
  const supportsGrouping = GROUPING_SUPPORTED_TYPES.has(chartType);

  return (
    <div className={CARD}>
      <div className={HEADING}>{t("pptx.chart.heading")}</div>
      <div className="text-[11px] text-muted-foreground mb-1">
        {seriesCount} {t("pptx.chart.series")} &middot; {categoryCount}{" "}
        {t("pptx.chart.categories")}
      </div>

      {/* Title */}
      <label className="flex items-center gap-2 text-[11px]">
        <span className="w-10 text-muted-foreground shrink-0">
          {t("pptx.chart.title")}
        </span>
        <input
          type="text"
          disabled={!canEdit}
          className={INPUT}
          value={title ?? ""}
          onChange={(e) => onUpdateChartData({ title: e.target.value })}
        />
      </label>

      {/* Chart type selector */}
      <label className="flex items-center gap-2 text-[11px]">
        <span className="w-10 text-muted-foreground shrink-0">
          {t("pptx.chart.type")}
        </span>
        <select
          disabled={!canEdit}
          className={INPUT}
          value={chartType}
          onChange={(e) =>
            onUpdateChartData({
              chartType: e.target.value as PptxChartType,
            })
          }
        >
          {CHART_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </label>

      {/* Grouping mode (bar/line/area only) */}
      {supportsGrouping && (
        <label className="flex items-center gap-2 text-[11px]">
          <span className="w-10 text-muted-foreground shrink-0">
            {t("pptx.chart.grouping")}
          </span>
          <select
            disabled={!canEdit}
            className={INPUT}
            value={grouping ?? "clustered"}
            onChange={(e) =>
              onUpdateChartData({
                grouping: e.target.value as PptxChartData["grouping"],
              })
            }
          >
            {GROUPING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
