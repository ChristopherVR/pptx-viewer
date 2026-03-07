import React, { useCallback } from "react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import type { PptxCustomProperty } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentPropertiesCustomTabProps {
  customProperties: PptxCustomProperty[];
  onUpdate: (next: PptxCustomProperty[]) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CUSTOM_PROPERTY_TYPES: Array<{ value: string; labelKey: string }> = [
  { value: "lpwstr", labelKey: "pptx.documentProperties.custom.typeText" },
  { value: "i4", labelKey: "pptx.documentProperties.custom.typeNumber" },
  { value: "filetime", labelKey: "pptx.documentProperties.custom.typeDate" },
  { value: "bool", labelKey: "pptx.documentProperties.custom.typeYesNo" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentPropertiesCustomTab({
  customProperties,
  onUpdate,
}: DocumentPropertiesCustomTabProps): React.ReactElement {
  const { t } = useTranslation();

  const handleAdd = useCallback(() => {
    onUpdate([...customProperties, { name: "", value: "", type: "lpwstr" }]);
  }, [customProperties, onUpdate]);

  const handleDelete = useCallback(
    (index: number) => {
      onUpdate(customProperties.filter((_, i) => i !== index));
    },
    [customProperties, onUpdate],
  );

  const handleChangeName = useCallback(
    (index: number, name: string) => {
      onUpdate(
        customProperties.map((prop, i) =>
          i === index ? { ...prop, name } : prop,
        ),
      );
    },
    [customProperties, onUpdate],
  );

  const handleChangeValue = useCallback(
    (index: number, value: string) => {
      onUpdate(
        customProperties.map((prop, i) =>
          i === index ? { ...prop, value } : prop,
        ),
      );
    },
    [customProperties, onUpdate],
  );

  const handleChangeType = useCallback(
    (index: number, type: string) => {
      onUpdate(
        customProperties.map((prop, i) =>
          i === index ? { ...prop, type } : prop,
        ),
      );
    },
    [customProperties, onUpdate],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("pptx.documentProperties.custom.description")}
      </p>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_1fr_100px_32px] gap-1 text-[11px] font-medium text-muted-foreground px-1">
        <span>{t("pptx.documentProperties.custom.name")}</span>
        <span>{t("pptx.documentProperties.custom.value")}</span>
        <span>{t("pptx.documentProperties.custom.type")}</span>
        <span />
      </div>

      {/* Rows */}
      <div className="max-h-[240px] overflow-y-auto space-y-1">
        {customProperties.map((prop, index) => (
          <div
            key={`custom-prop-${index}`}
            className="grid grid-cols-[1fr_1fr_100px_32px] gap-1 items-center"
          >
            <input
              type="text"
              className="w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder={t("pptx.documentProperties.custom.namePlaceholder")}
              value={prop.name}
              onChange={(e) => handleChangeName(index, e.target.value)}
            />
            {prop.type === "bool" ? (
              <select
                className="w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={prop.value}
                onChange={(e) => handleChangeValue(index, e.target.value)}
              >
                <option value="true">
                  {t("pptx.documentProperties.custom.yes")}
                </option>
                <option value="false">
                  {t("pptx.documentProperties.custom.no")}
                </option>
              </select>
            ) : (
              <input
                type={prop.type === "i4" ? "number" : "text"}
                className="w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                placeholder={t(
                  "pptx.documentProperties.custom.valuePlaceholder",
                )}
                value={prop.value}
                onChange={(e) => handleChangeValue(index, e.target.value)}
              />
            )}
            <select
              className="w-full rounded border border-border bg-muted px-2 py-1 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              value={prop.type}
              onChange={(e) => handleChangeType(index, e.target.value)}
            >
              {CUSTOM_PROPERTY_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleDelete(index)}
              className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
              aria-label={t("pptx.documentProperties.custom.deleteProperty")}
            >
              <LuTrash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {customProperties.length === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center py-4">
          {t("pptx.documentProperties.custom.empty")}
        </p>
      )}

      {/* Add button */}
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
      >
        <LuPlus className="w-3.5 h-3.5" />
        {t("pptx.documentProperties.custom.addProperty")}
      </button>
    </div>
  );
}
