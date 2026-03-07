import React from "react";
import { useTranslation } from "react-i18next";

import { normalizeHexColor } from "../../utils";
import { DebouncedColorInput } from "./DebouncedColorInput";
import type { EffectSectionProps } from "./image-properties-types";

// ---------------------------------------------------------------------------
// Colour change toggle + from/to controls
// ---------------------------------------------------------------------------

export function ColorChangeSection({
  fx,
  canEdit,
  updateEffects,
}: EffectSectionProps): React.ReactElement {
  const { t } = useTranslation();
  const cc = fx?.clrChange;
  return (
    <div className="space-y-1 text-[11px]">
      <label className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">
          {t("pptx.image.colorChange")}
        </span>
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={Boolean(cc)}
          onChange={(e) =>
            updateEffects({
              clrChange: e.target.checked
                ? {
                    clrFrom: "#ffffff",
                    clrTo: "#000000",
                    clrToTransparent: false,
                  }
                : undefined,
            })
          }
        />
      </label>
      {cc && (
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {t("pptx.image.colorChangeFrom")}
            </span>
            <DebouncedColorInput
              disabled={!canEdit}
              value={normalizeHexColor(cc.clrFrom, "#ffffff")}
              className="h-6 w-8 rounded border border-border bg-transparent cursor-pointer"
              onCommit={(hex) =>
                updateEffects({
                  clrChange: {
                    ...cc,
                    clrFrom: hex,
                    clrTo: cc.clrTo ?? "#000000",
                  },
                })
              }
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {t("pptx.image.colorChangeTo")}
            </span>
            <DebouncedColorInput
              disabled={!canEdit || Boolean(cc.clrToTransparent)}
              value={normalizeHexColor(cc.clrTo, "#000000")}
              className="h-6 w-8 rounded border border-border bg-transparent cursor-pointer"
              onCommit={(hex) =>
                updateEffects({
                  clrChange: {
                    ...cc,
                    clrFrom: cc.clrFrom ?? "#ffffff",
                    clrTo: hex,
                  },
                })
              }
            />
          </label>
          <label className="flex items-center justify-between gap-2 col-span-2">
            <span className="text-muted-foreground">
              {t("pptx.image.colorChangeTransparent")}
            </span>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={Boolean(cc.clrToTransparent)}
              onChange={(e) =>
                updateEffects({
                  clrChange: {
                    clrFrom: cc.clrFrom ?? "#ffffff",
                    clrTo: cc.clrTo ?? "#000000",
                    clrToTransparent: e.target.checked,
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
