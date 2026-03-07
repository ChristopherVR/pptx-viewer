/**
 * usePrintHandlers — Print dialog and print-with-settings logic for
 * slides, notes, handouts, and outline layouts.
 */
import { useState, type RefObject } from "react";
import type { PptxSlide } from "../../core";
import { captureAllSlidesAsPngDataUrls } from "../utils/export";
import { escapeHtml } from "../utils/electron-files";
import type { PrintSettings } from "../components/PrintDialog";

export interface UsePrintHandlersInput {
  slides: PptxSlide[];
  activeSlideIndex: number;
  canvasStageRef: RefObject<HTMLDivElement | null>;
  setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
}

export interface PrintHandlersResult {
  handlePrint: () => void;
  handlePrintWithSettings: (settings: PrintSettings) => Promise<void>;
  isPrintDialogOpen: boolean;
  setIsPrintDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function openPrintWindow(
  title: string,
  bodyHtml: string,
  orientation: "landscape" | "portrait",
  colorFilter: string,
  frameSlides: boolean,
): boolean {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return false;
  const frameStyle = frameSlides
    ? "img.slide-img, .notes-slide, .handout-cell img { border: 2px solid #000 !important; }"
    : "";
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #ffffff; color: #111827; font: 12px/1.4 "Segoe UI", Arial, sans-serif; ${colorFilter} }
      .page { page-break-after: always; padding: 10mm; width: 100%; }
      .page:last-child { page-break-after: auto; }
      .slide-page { display: flex; align-items: center; justify-content: center; min-height: 250mm; }
      .slide-page img.slide-img { max-width: 100%; max-height: 240mm; border-radius: 4px; }
      .notes-page { display: grid; grid-template-rows: auto 1fr; gap: 4mm; min-height: 250mm; }
      .notes-slide { width: 100%; border: 1px solid #d1d5db; border-radius: 4px; }
      .notes-text { border: 1px solid #d1d5db; border-radius: 4px; padding: 3mm; white-space: pre-wrap; }
      .handout-grid { display: grid; gap: 3mm; width: 100%; height: 250mm; }
      .handout-cell { border: 1px solid #d1d5db; border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #ffffff; }
      .handout-cell img { width: 100%; height: 100%; object-fit: contain; display: block; }
      .handout-grid-3 { display: flex; flex-direction: column; gap: 4mm; width: 100%; height: 250mm; }
      .handout-row-3 { display: flex; gap: 4mm; flex: 1; }
      .handout-row-3 .handout-cell { flex: 0 0 45%; }
      .handout-note-lines { flex: 1; position: relative; border-left: 1px solid #d1d5db; padding-left: 3mm; }
      .handout-note-line { position: absolute; left: 3mm; right: 0; height: 0; border-bottom: 1px solid #d1d5db; }
      .outline-page { padding: 10mm; }
      .outline-page h2 { font-size: 14px; margin: 12px 0 4px; color: #374151; }
      .outline-page p { font-size: 12px; margin: 2px 0 2px 16px; color: #4b5563; }
      @page { size: ${orientation}; margin: 8mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      ${frameStyle}
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
  return true;
}

export function usePrintHandlers(
  input: UsePrintHandlersInput,
): PrintHandlersResult {
  const { slides, activeSlideIndex, canvasStageRef, setActiveSlideIndex } =
    input;
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  const handlePrint = () => {
    setIsPrintDialogOpen(true);
  };

  const handlePrintWithSettings = async (settings: PrintSettings) => {
    setIsPrintDialogOpen(false);
    const colorFilter = (() => {
      if (settings.colorMode === "grayscale") return "filter: grayscale(1);";
      if (settings.colorMode === "blackAndWhite")
        return "filter: grayscale(1) contrast(2);";
      return "";
    })();

    const slideIndices: number[] = (() => {
      if (settings.slideRange === "current") return [activeSlideIndex];
      if (settings.slideRange === "custom") {
        const from = Math.max(0, settings.customRangeFrom - 1);
        const to = Math.min(slides.length - 1, settings.customRangeTo - 1);
        return Array.from({ length: to - from + 1 }, (_, i) => from + i);
      }
      return Array.from({ length: slides.length }, (_, i) => i);
    })();

    if (settings.printWhat === "outline") {
      const outlineHtml = slideIndices
        .map((idx) => {
          const slide = slides[idx];
          if (!slide) return "";
          const title = slide.elements?.find((el) => "text" in el && el.text);
          const titleText =
            title && "text" in title ? String(title.text) : `Slide ${idx + 1}`;
          const notes = slide.notes?.trim() || "";
          return `<h2>${escapeHtml(titleText)}</h2>${notes ? `<p>${escapeHtml(notes)}</p>` : ""}`;
        })
        .join("");
      openPrintWindow(
        "Outline",
        `<div class="outline-page">${outlineHtml}</div>`,
        settings.orientation,
        colorFilter,
        settings.frameSlides,
      );
      return;
    }

    try {
      if (!canvasStageRef.current) return;
      const allImages = await captureAllSlidesAsPngDataUrls(
        canvasStageRef,
        slides.length,
        setActiveSlideIndex,
        activeSlideIndex,
        { scale: 2 },
      );
      if (allImages.length === 0) return;
      const slideImages = slideIndices
        .map((idx) => allImages[idx])
        .filter(Boolean) as string[];

      if (settings.printWhat === "slides") {
        const bodyHtml = slideImages
          .map(
            (img, i) =>
              `<section class="page slide-page"><img class="slide-img" src="${img}" alt="Slide ${slideIndices[i] + 1}" /></section>`,
          )
          .join("");
        openPrintWindow(
          "Slides",
          bodyHtml,
          settings.orientation,
          colorFilter,
          settings.frameSlides,
        );
        return;
      }

      if (settings.printWhat === "notes") {
        const notesPages = slideImages
          .map((img, i) => {
            const idx = slideIndices[i];
            const notes = slides[idx]?.notes?.trim() || "";
            return `<section class="page notes-page">
  <img class="notes-slide" src="${img}" alt="Slide ${idx + 1}" />
  <div class="notes-text">${escapeHtml(notes)}</div>
</section>`;
          })
          .join("");
        openPrintWindow(
          "Notes Pages",
          notesPages,
          "portrait",
          colorFilter,
          settings.frameSlides,
        );
        return;
      }

      if (settings.printWhat === "handouts") {
        const spp = settings.slidesPerPage;
        const layoutMap: Record<number, { rows: number; columns: number }> = {
          1: { rows: 1, columns: 1 },
          2: { rows: 2, columns: 1 },
          3: { rows: 3, columns: 1 },
          4: { rows: 2, columns: 2 },
          6: { rows: 3, columns: 2 },
          9: { rows: 3, columns: 3 },
        };
        const grid = layoutMap[spp] ?? { rows: 3, columns: 2 };
        const isThreePerPage = spp === 3;
        const pages: string[] = [];
        const buildNoteLines = () => {
          const lines = Array.from(
            { length: 8 },
            (_, i) =>
              `<div class="handout-note-line" style="top: ${((i + 1) / 9) * 100}%"></div>`,
          ).join("");
          return `<div class="handout-note-lines">${lines}</div>`;
        };
        for (let i = 0; i < slideImages.length; i += spp) {
          const pageImgs = slideImages.slice(i, i + spp);
          if (isThreePerPage) {
            const rows = Array.from({ length: spp }, (_, cellIndex) => {
              const img = pageImgs[cellIndex];
              const slideCell = img
                ? `<div class="handout-cell"><img src="${img}" alt="Slide ${slideIndices[i + cellIndex] + 1}" /></div>`
                : `<div class="handout-cell"></div>`;
              return `<div class="handout-row-3">${slideCell}${buildNoteLines()}</div>`;
            }).join("");
            pages.push(
              `<section class="page"><div class="handout-grid-3">${rows}</div></section>`,
            );
          } else {
            const cells = Array.from({ length: spp }, (_, cellIndex) => {
              const img = pageImgs[cellIndex];
              return img
                ? `<div class="handout-cell"><img src="${img}" alt="Slide ${slideIndices[i + cellIndex] + 1}" /></div>`
                : `<div class="handout-cell"></div>`;
            }).join("");
            pages.push(
              `<section class="page"><div class="handout-grid" style="grid-template-columns: repeat(${grid.columns}, minmax(0, 1fr)); grid-template-rows: repeat(${grid.rows}, minmax(0, 1fr));">${cells}</div></section>`,
            );
          }
        }
        openPrintWindow(
          `Handout ${spp} per page`,
          pages.join(""),
          "portrait",
          colorFilter,
          settings.frameSlides,
        );
      }
    } catch (err) {
      console.error("[PowerPointViewer] Print layout failed:", err);
    }
  };

  return {
    handlePrint,
    handlePrintWithSettings,
    isPrintDialogOpen,
    setIsPrintDialogOpen,
  };
}
