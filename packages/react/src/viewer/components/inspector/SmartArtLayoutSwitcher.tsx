import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../utils";
import type {
  PptxSmartArtData,
  SmartArtLayoutType,
} from "pptx-viewer-core";
import {
  SWITCHABLE_LAYOUT_TYPES,
  switchSmartArtLayout,
} from "pptx-viewer-core";
import { THUMB_COMPONENTS } from "./smartart-layout-thumbnails";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface SmartArtLayoutSwitcherProps {
  /** Current SmartArt data for the selected element. */
  smartArtData: PptxSmartArtData;
  /** Whether the user can edit (not read-only / template). */
  canEdit: boolean;
  /** Callback to apply updated SmartArt data. */
  onUpdateSmartArt: (patch: Partial<PptxSmartArtData>) => void;
}

/* ------------------------------------------------------------------ */
/*  Layout Thumbnail Descriptors                                      */
/* ------------------------------------------------------------------ */

interface LayoutDescriptor {
  type: SmartArtLayoutType;
  i18nKey: string;
}

const LAYOUT_DESCRIPTORS: readonly LayoutDescriptor[] =
  SWITCHABLE_LAYOUT_TYPES.map((type) => ({
    type,
    i18nKey: `pptx.smartart.category.${type}`,
  }));

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

/**
 * SmartArt layout switcher grid.
 *
 * Presents a visual grid of layout thumbnails. Clicking a thumbnail
 * switches the SmartArt to that layout while preserving all node data,
 * connections, and styling.
 */
export function SmartArtLayoutSwitcher({
  smartArtData,
  canEdit,
  onUpdateSmartArt,
}: SmartArtLayoutSwitcherProps): React.ReactElement {
  const { t } = useTranslation();
  const currentLayout = smartArtData.resolvedLayoutType ?? "list";

  const handleLayoutSwitch = (newLayout: SmartArtLayoutType): void => {
    if (!canEdit || newLayout === currentLayout) return;

    const updated = switchSmartArtLayout(smartArtData, newLayout);
    // Only send the diff fields that changed
    onUpdateSmartArt({
      layoutType: updated.layoutType,
      resolvedLayoutType: updated.resolvedLayoutType,
      layout: updated.layout,
    });
  };

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] text-muted-foreground">
        {t("pptx.smartart.switchLayout")}
      </span>
      <div className="grid grid-cols-3 gap-1.5">
        {LAYOUT_DESCRIPTORS.map(({ type, i18nKey }) => {
          const isActive = currentLayout === type;
          const ThumbComponent = THUMB_COMPONENTS[type];

          return (
            <button
              key={type}
              type="button"
              disabled={!canEdit}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded border p-1.5 transition-colors",
                "text-[9px] leading-tight",
                isActive
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                !canEdit && "opacity-50 cursor-not-allowed",
              )}
              onClick={() => handleLayoutSwitch(type)}
              title={t(i18nKey)}
            >
              <div className="w-10 h-7">
                {ThumbComponent ? <ThumbComponent /> : null}
              </div>
              <span className="truncate w-full text-center">{t(i18nKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
