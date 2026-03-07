import React from "react";
import { useTranslation } from "react-i18next";

import { normalizeHexColor } from "../../utils";
import { DebouncedColorInput } from "./DebouncedColorInput";
import type { EffectSectionProps } from "./image-properties-types";

// ---------------------------------------------------------------------------
// Colour wash toggle + controls
// ---------------------------------------------------------------------------

export function ColorWashSection({
  fx,
  canEdit,
  updateEffects,
}: EffectSectionProps): React.ReactElement {
  const { t } = useTranslation();
  const wash = fx?.colorWash;
  return (
    <div className="space-y-1 text-[11px]">
      <label className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">
          {t("pptx.image.colorWash")}
        </span>
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={Boolean(wash)}
          onChange={(e) =>
            updateEffects({
              colorWash: e.target.checked
                ? { color: "#0066cc", opacity: 40 }
                : undefined,
            })
          }
        />
      </label>
      {wash && (
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {t("pptx.image.washColor")}
            </span>
            <DebouncedColorInput
              disabled={!canEdit}
              value={normalizeHexColor(wash.color, "#0066cc")}
              className="h-6 w-8 rounded border border-border bg-transparent cursor-pointer"
              onCommit={(hex) =>
                updateEffects({
                  colorWash: { color: hex, opacity: wash.opacity ?? 40 },
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">
              {t("pptx.image.washOpacity")}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              disabled={!canEdit}
              className="accent-primary"
              value={wash.opacity}
              onChange={(e) =>
                updateEffects({
                  colorWash: {
                    color: wash.color ?? "#0066cc",
                    opacity: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}
