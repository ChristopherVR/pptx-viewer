/**
 * Slides-only PDF builder.
 *
 * Generates a landscape PDF with one slide image per page. The pure PDF
 * byte-assembly (`buildSlidesPdfBytes`) now lives in `pptx-viewer-shared`
 * (`export/pdf-slides`); only the DOM-bound canvas->JPEG conversion and the
 * final Blob/object-URL wrapping stay here.
 *
 * @module pdf-builder-slides
 */

import {
	buildSlidesPdfBytes,
	buildTiledSlidesPdfBytes,
	canvasToJpegData,
} from 'pptx-viewer-shared';
import type { PdfTiledPageImage } from 'pptx-viewer-shared';

import type { PdfImageData } from './pdf-builder-types';

// `canvasToJpegData` (canvas -> JPEG bytes) now lives in `pptx-viewer-shared`
// (`export/canvas-jpeg`); re-export it to preserve the historical import path.
export { canvasToJpegData };

/* ------------------------------------------------------------------ */
/*  Slides-only PDF builder                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a PDF from pre-converted JPEG image data.
 *
 * This is the memory-efficient entry point: callers convert each canvas
 * to JPEG bytes immediately after rendering (via {@link canvasToJpegData}),
 * discard the canvas, and pass only the compact JPEG data here.
 *
 * Each image becomes a full page in landscape A4 (842 x 595 pt).
 *
 * @param images - Array of pre-converted JPEG image data.
 * @returns Object URL pointing to the generated PDF blob.
 */
export function buildPdfFromImageData(images: PdfImageData[]): string {
	const bytes = buildSlidesPdfBytes(images);
	const blob = new Blob([bytes], { type: 'application/pdf' });
	return URL.createObjectURL(blob);
}

/**
 * Build a PDF byte stream where each page may be composed of several tile
 * images instead of one full-page image (`buildTiledSlidesPdfBytes` in
 * `pptx-viewer-shared`) - what lets a PDF export escape the browser canvas
 * cap, since every tile is individually small but a PDF page has no
 * canvas-size limit of its own.
 *
 * @param pages - One entry per page: that page's tile images + placements.
 * @returns Object URL pointing to the generated PDF blob.
 */
export function buildPdfFromTiledImageData(pages: PdfTiledPageImage[][]): string {
	const bytes = buildTiledSlidesPdfBytes(pages);
	const blob = new Blob([bytes], { type: 'application/pdf' });
	return URL.createObjectURL(blob);
}

/**
 * Legacy wrapper: converts canvases to JPEG then builds PDF.
 *
 * Prefer {@link buildPdfFromImageData} with {@link canvasToJpegData} for
 * large presentations -- it lets you discard each canvas after conversion
 * instead of holding all canvases in memory simultaneously.
 *
 * @param canvases - Array of rendered slide canvases.
 * @returns Object URL pointing to the generated PDF blob.
 */
export function buildPdfFromCanvases(canvases: HTMLCanvasElement[]): string {
	const images = canvases.map((c) => canvasToJpegData(c));
	return buildPdfFromImageData(images);
}
