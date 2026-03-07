import { useTranslation } from "react-i18next";

import type { PptxChartStyle } from "../../../core";
import {
  CARD,
  HEADING,
  INPUT,
  LEGEND_POSITION_OPTIONS,
} from "./chart-panel-constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChartDisplayOptionsProps {
  style: PptxChartStyle | undefined;
  canEdit: boolean;
  onUpdateStyle: (patch: Partial<PptxChartStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ChartDisplayOptions({
  style,
  canEdit,
  onUpdateStyle,
}: ChartDisplayOptionsProps) {
  const { t } = useTranslation();

  return (
    <div className={CARD}>
      <div className={HEADING}>{t("pptx.chart.display")}</div>
      <div className="space-y-1.5">
        {/* Show title */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={style?.hasTitle ?? false}
            onChange={(e) => onUpdateStyle({ hasTitle: e.target.checked })}
            className="accent-primary"
          />
          <span className="text-[11px]">{t("pptx.chart.showTitle")}</span>
        </label>

        {/* Show legend */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={style?.hasLegend ?? false}
            onChange={(e) => onUpdateStyle({ hasLegend: e.target.checked })}
            className="accent-primary"
          />
          <span className="text-[11px]">{t("pptx.chart.showLegend")}</span>
        </label>

        {/* Legend position (only when legend visible) */}
        {style?.hasLegend && (
          <label className="flex items-center gap-2 text-[11px] ml-4">
            <span className="w-12 text-muted-foreground shrink-0">
              {t("pptx.chart.legendPosition")}
            </span>
            <select
              disabled={!canEdit}
              className={INPUT}
              value={style.legendPosition ?? "b"}
              onChange={(e) =>
                onUpdateStyle({
                  legendPosition: e.target.value,
                })
              }
            >
              {LEGEND_POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Gridlines */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={style?.hasGridlines ?? false}
            onChange={(e) => onUpdateStyle({ hasGridlines: e.target.checked })}
            className="accent-primary"
          />
          <span className="text-[11px]">{t("pptx.chart.showGridlines")}</span>
        </label>

        {/* Data labels */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={style?.hasDataLabels ?? false}
            onChange={(e) =>
              onUpdateStyle({
                hasDataLabels: e.target.checked,
              })
            }
            className="accent-primary"
          />
          <span className="text-[11px]">{t("pptx.chart.showDataLabels")}</span>
        </label>
      </div>
    </div>
  );
}
