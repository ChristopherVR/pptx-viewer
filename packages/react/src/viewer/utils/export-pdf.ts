/**
 * PDF and notes-page PDF slide export utilities.
 *
 * Split out of `export-slides.ts` (file-size limit) once that file grew past
 * PNG export plus every PDF variant; PNG export and the PNG-data-URL capture
 * helper stay in `export-slides.ts`.
 */
import {
	placeTileOnPage,
	PDF_SLIDES_PAGE_WIDTH_PT,
	PDF_SLIDES_PAGE_HEIGHT_PT,
} from 'pptx-viewer-shared';
import type { PdfTiledPageImage, RasterizeElementTilesResult } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

import type { NotesPdfExportOptions, PdfExportOptions, PngExportOptions } from './export-helpers';
import {
	downloadDataUrl,
	renderElementToTiledCanvas,
	renderElementToTiles,
	waitForRender,
} from './export-helpers';
import { buildPdfFromTiledImageData, buildNotesPdf, canvasToJpegData } from './pdf-builder';
import type { NotesPageInput } from './pdf-builder';

/**
 * Convert one slide's rasterised tiles into a PDF page: each tile becomes
 * its own JPEG (always within the browser canvas cap, since a tile came
 * from a capped-size canvas) placed at its proportional position on the
 * fixed-A4 page (`placeTileOnPage`, `PDF_SLIDES_PAGE_WIDTH_PT`/`_HEIGHT_PT`
 * from `pptx-viewer-shared`, matching `buildTiledSlidesPdfBytes`'s own page
 * size exactly). A single-tile export (the overwhelming majority) degrades
 * to exactly one full-page image, unchanged from before this migration.
 */
function tilesToPdfPage(tilesResult: RasterizeElementTilesResult): PdfTiledPageImage[] {
	return tilesResult.tiles.map((tile) => ({
		image: canvasToJpegData(tile.canvas),
		placement: placeTileOnPage(
			tile,
			tilesResult.fullWidth,
			tilesResult.fullHeight,
			PDF_SLIDES_PAGE_WIDTH_PT,
			PDF_SLIDES_PAGE_HEIGHT_PT,
		),
	}));
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
	filename: string = 'presentation.pdf',
	options: PdfExportOptions = {},
): Promise<void> {
	const { scale = 2, onProgress, signal } = options;
	// Each slide's tiles are converted to compact per-tile JPEG bytes
	// immediately after rendering, then the tile canvases are discarded. This
	// keeps peak memory bounded regardless of export scale, and (via
	// `renderElementToTiles`) escapes the browser canvas cap the same way PNG
	// export does: a page whose resolution would exceed the cap is composed
	// of several small tile images instead of one oversized canvas.
	const pages: PdfTiledPageImage[][] = [];

	for (let i = 0; i < totalSlides; i++) {
		if (signal?.aborted) {
			throw new DOMException('Export cancelled', 'AbortError');
		}
		onProgress?.(i, totalSlides);

		setActiveSlide(i);
		await waitForRender(150);

		const stageEl = slideStageRef.current;
		if (!stageEl) {
			console.warn(`[export] Could not find slide stage element for slide ${i}`);
			continue;
		}

		const tilesResult = await renderElementToTiles(stageEl, scale);
		pages.push(tilesToPdfPage(tilesResult));
		// Tile canvases are now unreferenced and eligible for GC.
	}

	onProgress?.(totalSlides, totalSlides);

	// Restore the user's original slide
	setActiveSlide(currentSlideIndex);

	if (pages.length === 0) {
		throw new Error(translationsEn['pptx.export.errorNoSlidesPdf']);
	}

	const pdfBlobUrl = buildPdfFromTiledImageData(pages);
	downloadDataUrl(pdfBlobUrl, filename);
}

/* ------------------------------------------------------------------ */
/*  Notes PDF Export                                                   */
/* ------------------------------------------------------------------ */

/**
 * Export all slides as a notes-page PDF: each page contains the slide image
 * in the upper 2/3 and speaker notes text in the lower 1/3.
 *
 * Uses portrait US Letter layout (8.5" x 11") matching PowerPoint's
 * "Notes Pages" print layout.
 *
 * @param slideStageRef     - React ref to the slide stage element.
 * @param totalSlides       - Total number of slides.
 * @param setActiveSlide    - Callback to switch the viewer to slide `i`.
 * @param currentSlideIndex - The slide index to restore after export.
 * @param slideNotes        - Array of plain-text notes, one per slide (index-aligned).
 * @param filename          - Downloaded filename (default: "presentation-notes.pdf").
 * @param options           - Scale and progress callback.
 */
export async function exportAllSlidesAsNotesPdf(
	slideStageRef: React.RefObject<HTMLElement | null>,
	totalSlides: number,
	setActiveSlide: (index: number) => void,
	currentSlideIndex: number,
	slideNotes: (string | undefined)[],
	filename: string = 'presentation-notes.pdf',
	options: NotesPdfExportOptions = {},
): Promise<void> {
	const { scale = 2, onProgress, signal } = options;
	const pages: NotesPageInput[] = [];

	for (let i = 0; i < totalSlides; i++) {
		if (signal?.aborted) {
			throw new DOMException('Export cancelled', 'AbortError');
		}
		onProgress?.(i, totalSlides);

		setActiveSlide(i);
		await waitForRender(150);

		const stageEl = slideStageRef.current;
		if (!stageEl) {
			console.warn(`[export] Could not find slide stage element for slide ${i}`);
			continue;
		}

		// The notes-page layout draws exactly one image per primary page
		// (alongside wrapped notes text), so this goes through the
		// single-canvas raster path (tiled and stitched transparently past the
		// browser canvas cap, same full resolution as the main "PDF" export's
		// per-tile-placement path) rather than placing several tile images on
		// the page itself.
		const { canvas } = await renderElementToTiledCanvas(stageEl, scale);
		pages.push({
			canvas,
			notes: slideNotes[i],
			slideNumber: i + 1,
		});
	}

	onProgress?.(totalSlides, totalSlides);

	// Restore the user's original slide
	setActiveSlide(currentSlideIndex);

	if (pages.length === 0) {
		throw new Error(translationsEn['pptx.export.errorNoSlidesNotesPdf']);
	}

	const pdfDataUrl = buildNotesPdf(pages);
	downloadDataUrl(pdfDataUrl, filename);
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
	const tilesResult = await renderElementToTiles(slideElement, scale, backgroundColor);
	const pdfDataUrl = buildPdfFromTiledImageData([tilesToPdfPage(tilesResult)]);
	downloadDataUrl(pdfDataUrl, `slide-${slideIndex + 1}.pdf`);
}
