/**
 * PNG and PDF slide export utilities.
 */
import React from "react";

import { buildPdfFromCanvases } from "./pdf-builder";
import type {
  PngExportOptions,
  PdfExportOptions,
  SlideCaptureOptions,
} from "./export-helpers";
import {
  downloadBlob,
  downloadDataUrl,
  renderElementToCanvas,
  waitForRender,
} from "./export-helpers";

/* ------------------------------------------------------------------ */
/*  PNG Export                                                        */
/* ------------------------------------------------------------------ */

/**
 * Export a single slide element to a PNG Blob.
 *
 * @param slideElement - The DOM element representing the slide stage
 *                       (typically `canvasStageRef.current`).
 * @param options      - Scale, background colour, etc.
 * @returns            A PNG Blob ready for download or clipboard.
 */
export async function exportSlideToPngBlob(
  slideElement: HTMLElement,
  options: PngExportOptions = {},
): Promise<Blob> {
  const { scale = 2, backgroundColor } = options;

  const canvas = await renderElementToCanvas(
    slideElement,
    scale,
    backgroundColor,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas toBlob returned null"));
      }
    }, "image/png");
  });
}

/**
 * Export the current slide as a PNG and trigger a browser download.
 *
 * @param slideElement   - The slide stage DOM element.
 * @param slideIndex     - Zero-based slide index (used in filename).
 * @param options        - Scale, background colour, etc.
 */
export async function exportSlideAsPng(
  slideElement: HTMLElement,
  slideIndex: number,
  options: PngExportOptions = {},
): Promise<void> {
  const blob = await exportSlideToPngBlob(slideElement, options);
  downloadBlob(blob, `slide-${slideIndex + 1}.png`);
}

/* ------------------------------------------------------------------ */
/*  Copy slide to clipboard                                           */
/* ------------------------------------------------------------------ */

/**
 * Render the current slide as a PNG and copy it to the system clipboard.
 *
 * @param slideElement - The slide stage DOM element.
 * @param options      - Scale, background colour, etc.
 */
export async function copySlideToClipboard(
  slideElement: HTMLElement,
  options: PngExportOptions = {},
): Promise<void> {
  const blob = await exportSlideToPngBlob(slideElement, options);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/* ------------------------------------------------------------------ */
/*  PDF Export                                                        */
/* ------------------------------------------------------------------ */

/**
 * Export all slides as a multi-page PDF and trigger a browser download.
 *
 * Because each slide must be rendered in the DOM to be captured, the caller
 * provides a `setActiveSlide` callback that switches the viewer to a given
 * slide index and waits for the DOM to settle.
 *
 * @param slideStageRef    - React ref whose `.current` points to the slide
 *                           stage element. Re-read after each slide switch.
 * @param totalSlides      - Total number of slides in the presentation.
 * @param setActiveSlide   - Async callback to switch the viewer to slide `i`.
 *                           Should call the state setter and await the next paint.
 * @param currentSlideIndex - The slide index the user was viewing before export
 *                            (restored after export completes).
 * @param filename         - Downloaded filename (default: "presentation.pdf").
 * @param options          - Scale and progress callback.
 */
export async function exportAllSlidesAsPdf(
  slideStageRef: React.RefObject<HTMLElement | null>,
  totalSlides: number,
  setActiveSlide: (index: number) => void,
  currentSlideIndex: number,
  filename: string = "presentation.pdf",
  options: PdfExportOptions = {},
): Promise<void> {
  const { scale = 2, onProgress } = options;
  const canvases: HTMLCanvasElement[] = [];

  for (let i = 0; i < totalSlides; i++) {
    onProgress?.(i, totalSlides);

    // Switch to slide i
    setActiveSlide(i);
    await waitForRender(150);

    const stageEl = slideStageRef.current;
    if (!stageEl) {
      console.warn(
        `[export] Could not find slide stage element for slide ${i}`,
      );
      continue;
    }

    const canvas = await renderElementToCanvas(stageEl, scale);
    canvases.push(canvas);
  }

  onProgress?.(totalSlides, totalSlides);

  // Restore the user's original slide
  setActiveSlide(currentSlideIndex);

  if (canvases.length === 0) {
    throw new Error("No slides were captured for PDF export");
  }

  // Build PDF using the existing minimal PDF builder
  const pdfDataUrl = buildPdfFromCanvases(canvases);
  downloadDataUrl(pdfDataUrl, filename);
}

/**
 * Capture all slides as PNG data URLs.
 *
 * Reuses the same slide-switching and render wait strategy as PDF export so
 * callers can build custom print layouts (handouts, notes pages, etc.).
 */
export async function captureAllSlidesAsPngDataUrls(
  slideStageRef: React.RefObject<HTMLElement | null>,
  totalSlides: number,
  setActiveSlide: (index: number) => void,
  currentSlideIndex: number,
  options: SlideCaptureOptions = {},
): Promise<string[]> {
  const { scale = 2, onProgress } = options;
  const dataUrls: string[] = [];

  for (let i = 0; i < totalSlides; i++) {
    onProgress?.(i, totalSlides);
    setActiveSlide(i);
    await waitForRender(150);

    const stageEl = slideStageRef.current;
    if (!stageEl) {
      console.warn(
        `[export] Could not find slide stage element for slide ${i}`,
      );
      continue;
    }

    const canvas = await renderElementToCanvas(stageEl, scale);
    dataUrls.push(canvas.toDataURL("image/png"));
  }

  onProgress?.(totalSlides, totalSlides);
  setActiveSlide(currentSlideIndex);
  return dataUrls;
}

/**
 * Export the current slide as a single-page PDF and trigger a browser download.
 *
 * @param slideElement - The slide stage DOM element.
 * @param slideIndex   - Zero-based slide index (used in filename).
 * @param options      - Scale options.
 */
export async function exportSlideAsPdf(
  slideElement: HTMLElement,
  slideIndex: number,
  options: PngExportOptions = {},
): Promise<void> {
  const { scale = 2, backgroundColor } = options;
  const canvas = await renderElementToCanvas(
    slideElement,
    scale,
    backgroundColor,
  );
  const pdfDataUrl = buildPdfFromCanvases([canvas]);
  downloadDataUrl(pdfDataUrl, `slide-${slideIndex + 1}.pdf`);
}
