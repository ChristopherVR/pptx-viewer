import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";

import type { PptxAppProperties } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the {@link DocumentPropertiesStatisticsTab} component.
 */
export interface DocumentPropertiesStatisticsTabProps {
  /** Application-level metadata for the presentation. */
  appProperties: PptxAppProperties;
  /** Callback to apply partial updates to editable app properties. */
  onUpdateAppProperties: (updates: Partial<PptxAppProperties>) => void;
  /** Whether the editable fields (company, manager) are enabled. */
  canEdit: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Describes a single row in the statistics tab. */
interface StatisticsField {
  /** Property key on `PptxAppProperties`. */
  key: keyof PptxAppProperties;
  /** i18n key for the field label. */
  labelKey: string;
  /** Whether the field can be edited by the user. */
  editable: boolean;
}

/** Ordered list of statistics fields displayed in the tab. */
const STATISTICS_FIELDS: StatisticsField[] = [
  {
    key: "application",
    labelKey: "pptx.documentProperties.statistics.application",
    editable: false,
  },
  {
    key: "appVersion",
    labelKey: "pptx.documentProperties.statistics.appVersion",
    editable: false,
  },
  {
    key: "presentationFormat",
    labelKey: "pptx.documentProperties.statistics.presentationFormat",
    editable: false,
  },
  {
    key: "slides",
    labelKey: "pptx.documentProperties.statistics.slides",
    editable: false,
  },
  {
    key: "hiddenSlides",
    labelKey: "pptx.documentProperties.statistics.hiddenSlides",
    editable: false,
  },
  {
    key: "notes",
    labelKey: "pptx.documentProperties.statistics.notes",
    editable: false,
  },
  {
    key: "totalTime",
    labelKey: "pptx.documentProperties.statistics.totalTime",
    editable: false,
  },
  {
    key: "words",
    labelKey: "pptx.documentProperties.statistics.words",
    editable: false,
  },
  {
    key: "paragraphs",
    labelKey: "pptx.documentProperties.statistics.paragraphs",
    editable: false,
  },
  {
    key: "template",
    labelKey: "pptx.documentProperties.statistics.template",
    editable: false,
  },
  {
    key: "company",
    labelKey: "pptx.documentProperties.statistics.company",
    editable: true,
  },
  {
    key: "manager",
    labelKey: "pptx.documentProperties.statistics.manager",
    editable: true,
  },
];

/**
 * Formats a total editing time in minutes as "X hours Y minutes".
 *
 * @param minutes - Total minutes, or `undefined` if not available.
 * @param t - i18n translation function.
 * @returns A human-readable duration string.
 */
function formatTotalTime(
  minutes: number | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (minutes === undefined || minutes === null) {
    return t("pptx.documentProperties.statistics.notAvailable");
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return t("pptx.documentProperties.statistics.hoursMinutes", {
    hours,
    minutes: remainingMinutes,
  });
}

/**
 * Formats a statistics field value for display.
 *
 * Handles the special `totalTime` key (delegates to {@link formatTotalTime})
 * and falls back to "N/A" for `undefined`/`null` values.
 *
 * @param key - The property key being formatted.
 * @param value - The raw value from `PptxAppProperties`.
 * @param t - i18n translation function.
 * @returns A formatted display string.
 */
function formatFieldValue(
  key: keyof PptxAppProperties,
  value: string | number | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (key === "totalTime") {
    return formatTotalTime(value as number | undefined, t);
  }
  if (value === undefined || value === null) {
    return t("pptx.documentProperties.statistics.notAvailable");
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Tab content displaying read-only presentation statistics and editable
 * company / manager fields.
 *
 * Non-editable fields (slides, words, paragraphs, etc.) are rendered as
 * plain text; editable fields render as inputs when `canEdit` is `true`.
 *
 * @param props - {@link DocumentPropertiesStatisticsTabProps}
 * @returns The rendered statistics tab.
 */
export function DocumentPropertiesStatisticsTab({
  appProperties,
  onUpdateAppProperties,
  canEdit,
}: DocumentPropertiesStatisticsTabProps): React.ReactElement {
  const { t } = useTranslation();

  const handleEditableChange = useCallback(
    (key: keyof PptxAppProperties, value: string) => {
      onUpdateAppProperties({ [key]: value });
    },
    [onUpdateAppProperties],
  );

  return (
    <div className="space-y-3">
      {STATISTICS_FIELDS.map(({ key, labelKey, editable }) => (
        <div key={key} className="flex items-center gap-3">
          <label className="block text-xs text-foreground w-[140px] shrink-0">
            {t(labelKey)}
          </label>
          {editable && canEdit ? (
            <input
              type="text"
              className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              value={String(appProperties[key] ?? "")}
              onChange={(e) => handleEditableChange(key, e.target.value)}
            />
          ) : (
            <span className="flex-1 px-3 py-2 text-sm text-muted-foreground">
              {formatFieldValue(key, appProperties[key], t)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
