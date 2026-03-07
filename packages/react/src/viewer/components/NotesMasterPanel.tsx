import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { PptxNotesMaster } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotesMasterPanelProps {
  notesMaster: PptxNotesMaster | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotesMasterPanel({
  notesMaster,
}: NotesMasterPanelProps): React.ReactElement {
  const { t } = useTranslation();

  const placeholderLabels = useMemo(() => {
    if (!notesMaster?.placeholders) return [];
    return notesMaster.placeholders.map((ph) => {
      const typeLabel =
        ph.type === "body"
          ? t("pptx.master.notesMasterBody")
          : ph.type === "sldImg"
            ? t("pptx.master.notesMasterSlideImage")
            : ph.type === "hdr"
              ? t("pptx.master.notesMasterHeader")
              : ph.type === "ftr"
                ? t("pptx.master.notesMasterFooter")
                : ph.type === "dt"
                  ? t("pptx.master.notesMasterDate")
                  : ph.type === "sldNum"
                    ? t("pptx.master.notesMasterPageNumber")
                    : ph.type;
      return { type: ph.type, label: typeLabel, idx: ph.idx };
    });
  }, [notesMaster?.placeholders, t]);

  if (!notesMaster) {
    return (
      <div className="px-2 py-4 text-center text-xs text-muted-foreground">
        {t("pptx.master.noNotesMaster")}
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1">
      {/* Background info */}
      <div className="rounded-md border border-border/60 bg-muted/40 p-2">
        <div className="text-[10px] text-muted-foreground mb-1">
          {t("pptx.master.notesMasterBackground")}
        </div>
        <div
          className="w-full h-8 rounded border border-border"
          style={{ backgroundColor: notesMaster.backgroundColor ?? "#ffffff" }}
        />
      </div>

      {/* Placeholder list */}
      <div className="rounded-md border border-border/60 bg-muted/40 p-2">
        <div className="text-[10px] text-muted-foreground mb-1.5">
          {t("pptx.master.notesMasterPlaceholders")}
        </div>
        {placeholderLabels.length > 0 ? (
          <div className="space-y-1">
            {placeholderLabels.map((ph) => (
              <div
                key={`${ph.type}-${ph.idx ?? "default"}`}
                className="flex items-center gap-2 rounded px-1.5 py-1 bg-background/50 text-[10px] text-foreground"
              >
                <span className="w-2 h-2 rounded-full bg-green-500/60 flex-shrink-0" />
                {ph.label}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground">
            {t("pptx.master.noPlaceholders")}
          </div>
        )}
      </div>
    </div>
  );
}
