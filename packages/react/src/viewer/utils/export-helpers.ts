/**
 * Shared types and helper functions used by the export sub-modules.
 */
import { renderToCanvas } from "../../lib/canvas-export";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Progress callback invoked during multi-slide operations. */
export type ExportProgressCallback = (current: number, total: number) => void;

/** Options for PNG export. */
export interface PngExportOptions {
  /** Render scale multiplier (default 2 for retina quality). */
  scale?: number;
  /** Background colour passed to html2canvas. Defaults to slide background. */
  backgroundColor?: string;
}

/** Options for multi-slide PDF export. */
export interface PdfExportOptions {
  /** Render scale multiplier for each slide capture (default 2). */
  scale?: number;
  /** Progress callback: (currentSlide, totalSlides). */
  onProgress?: ExportProgressCallback;
}

/** Options for notes-page PDF export. */
export interface NotesPdfExportOptions {
  /** Render scale multiplier for each slide capture (default 2). */
  scale?: number;
  /** Progress callback: (currentSlide, totalSlides). */
  onProgress?: ExportProgressCallback;
}

/** Options for multi-slide image capture. */
export interface SlideCaptureOptions {
  /** Render scale multiplier for each slide capture (default 2). */
  scale?: number;
  /** Progress callback: (currentSlide, totalSlides). */
  onProgress?: ExportProgressCallback;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Trigger a browser download for a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  // Defer cleanup so the browser has time to start the download.
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Trigger a browser download for a data-URL string.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
  }, 200);
}

/**
 * Render an HTML element to a canvas using html2canvas.
 * Returns the resulting HTMLCanvasElement.
 */
export async function renderElementToCanvas(
  element: HTMLElement,
  scale: number = 2,
  backgroundColor?: string,
): Promise<HTMLCanvasElement> {
  const canvas = await renderToCanvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: backgroundColor ?? null,
    logging: false,
    // Ignore elements that interfere with export (selection overlays, snap lines, etc.)
    ignoreElements: (el: Element) => {
      const htmlEl = el as HTMLElement;
      // Skip elements with data-export-ignore attribute
      if (htmlEl.dataset?.exportIgnore === "true") return true;
      // Skip pointer-events-none overlays that are purely interactive guides
      if (
        htmlEl.classList?.contains("pointer-events-none") &&
        (htmlEl.classList.contains("z-50") ||
          htmlEl.classList.contains("z-[60]"))
      ) {
        return true;
      }
      return false;
    },
  });
  return canvas;
}

/**
 * Wait for a short tick so the DOM can repaint after a state change.
 * Uses double-rAF + a small timeout for robustness.
 */
export function waitForRender(ms: number = 100): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, ms);
      });
    });
  });
}
