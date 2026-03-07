import React from "react";
import { useTranslation } from "react-i18next";

import type { PptxHandoutMaster } from "pptx-viewer-core";
import { cn } from "../utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HANDOUT_SLIDES_PER_PAGE_OPTIONS = [1, 2, 3, 4, 6, 9] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HandoutMasterPanelProps {
  handoutMaster: PptxHandoutMaster | undefined;
  slidesPerPage: number;
  onSlidesPerPageChange: (count: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HandoutMasterPanel({
  handoutMaster,
  slidesPerPage,
  onSlidesPerPageChange,
}: HandoutMasterPanelProps): React.ReactElement {
  const { t } = useTranslation();

  if (!handoutMaster) {
    return (
      <div className="px-2 py-4 text-center text-xs text-muted-foreground">
        {t("pptx.master.noHandoutMaster")}
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1">
      {/* Slides per page selector */}
      <div className="rounded-md border border-border/60 bg-muted/40 p-2">
        <div className="text-[10px] text-muted-foreground mb-1.5">
          {t("pptx.master.handoutSlidesPerPage")}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {HANDOUT_SLIDES_PER_PAGE_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              className={cn(
                "px-2 py-1.5 rounded text-[11px] font-medium transition-colors",
                slidesPerPage === count
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent/50 text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
              onClick={() => onSlidesPerPageChange(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Background info */}
      <div className="rounded-md border border-border/60 bg-muted/40 p-2">
        <div className="text-[10px] text-muted-foreground mb-1">
          {t("pptx.master.handoutBackground")}
        </div>
        <div
          className="w-full h-8 rounded border border-border"
          style={{
            backgroundColor: handoutMaster.backgroundColor ?? "#ffffff",
          }}
        />
      </div>

      {/* Placeholder info */}
      {handoutMaster.placeholders && handoutMaster.placeholders.length > 0 && (
        <div className="rounded-md border border-border/60 bg-muted/40 p-2">
          <div className="text-[10px] text-muted-foreground mb-1.5">
            {t("pptx.master.handoutPlaceholders")}
          </div>
          <div className="space-y-1">
            {handoutMaster.placeholders.map((ph) => (
              <div
                key={`${ph.type}-${ph.idx ?? "default"}`}
                className="flex items-center gap-2 rounded px-1.5 py-1 bg-background/50 text-[10px] text-foreground"
              >
                <span className="w-2 h-2 rounded-full bg-purple-500/60 flex-shrink-0" />
                {ph.type}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
