import React, { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { PptxSlide, TextSegment } from "../../../core";
import {
  createPlainNotesSegments,
  escapeHtml,
  segmentsToParagraphs,
  segmentsToPlainText,
} from "./notes-utils";
import { renderRichNotesSegments } from "./notes-html";

/* ------------------------------------------------------------------ */
/*  Print Notes Dialog                                                 */
/* ------------------------------------------------------------------ */

export function NotesPrintDialog({
  slides,
  onClose,
}: {
  slides: PptxSlide[];
  onClose: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = useCallback(() => {
    const iframe = printFrameRef.current;
    if (!iframe?.contentWindow) return;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>
			body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #222; }
			.slide-page { page-break-after: always; margin-bottom: 40px; }
			.slide-page:last-child { page-break-after: auto; }
			.slide-header { font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #555; }
			.slide-thumb { width: 100%; max-width: 600px; aspect-ratio: 16/9; background: #f0f0f0;
				border: 1px solid #ccc; display: flex; align-items: center; justify-content: center;
				color: #999; font-size: 24px; margin-bottom: 16px; }
			.notes-text { font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
			.notes-text .bullet { margin-right: 6px; }
			.notes-text .para { margin: 2px 0; }
			@media print { body { padding: 0; } }
		</style></head><body>`);

    for (const slide of slides) {
      const segs = getSlideNotesSegments(slide);
      const paras = segmentsToParagraphs(segs);

      doc.write(`<div class="slide-page">`);
      doc.write(
        `<div class="slide-header">${escapeHtml(t("pptx.notes.slideN", { n: slide.slideNumber }))}</div>`,
      );
      doc.write(
        `<div class="slide-thumb">${escapeHtml(t("pptx.notes.slideN", { n: slide.slideNumber }))}</div>`,
      );
      doc.write(`<div class="notes-text">`);

      let numCounter = 0;
      for (const para of paras) {
        if (para.bulletType === "numbered") numCounter++;
        else numCounter = 0;

        const indent = para.indentLevel * 24;
        let prefix = "";
        if (para.bulletType === "bullet") prefix = "\u2022 ";
        else if (para.bulletType === "numbered") prefix = `${numCounter}. `;

        const text = para.segments
          .filter((s) => !s.isParagraphBreak)
          .map((s) => escapeHtml(s.text))
          .join("");

        doc.write(
          `<div class="para" style="padding-left:${indent}px">${escapeHtml(prefix)}${text}</div>`,
        );
      }

      doc.write(`</div></div>`);
    }

    doc.write(`</body></html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.print();
    }, 200);
  }, [slides, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border border-border rounded-lg shadow-xl w-[640px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-foreground">
            {t("pptx.notes.printNotes")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            {t("common.close")}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {slides.map((slide) => {
            const segs = getSlideNotesSegments(slide);
            const hasText = segmentsToPlainText(segs).trim().length > 0;

            return (
              <div
                key={slide.id}
                className="border border-border/50 rounded p-3"
              >
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  {t("pptx.notes.slideN", { n: slide.slideNumber })}
                </div>
                <div className="w-full aspect-video bg-muted rounded mb-2 flex items-center justify-center text-muted-foreground text-sm">
                  {t("pptx.notes.slideN", { n: slide.slideNumber })}
                </div>
                <div className="text-xs text-foreground whitespace-pre-wrap">
                  {hasText ? (
                    renderRichNotesSegments(segs)
                  ) : (
                    <span className="italic text-muted-foreground">
                      {t("pptx.notes.noNotes")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/80 text-white rounded"
          >
            {t("pptx.notes.print")}
          </button>
        </div>
        <iframe ref={printFrameRef} title="print-notes" className="hidden" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal helper                                                    */
/* ------------------------------------------------------------------ */

function getSlideNotesSegments(slide: PptxSlide): TextSegment[] {
  return slide.notesSegments && slide.notesSegments.length > 0
    ? slide.notesSegments
    : createPlainNotesSegments(slide.notes ?? "");
}
