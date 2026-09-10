/**
 * PNG slide export utilities.
 *
 * PDF and notes-PDF export live in `export-pdf.ts` (split out once this file
 * grew past the 300-LOC limit with every PDF variant included).
 */
import React from 'react';

import type { PngExportOptions, SlideCaptureOptions } from './export-helpers';
import {
	downloadBlob,
	renderElementToClampedCanvas,
	renderElementToRaster,
	rasterResultToPngBlob,
	waitForRender,
} from './export-helpers';

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

	const result = await renderElementToRaster(slideElement, scale, backgroundColor);
	return rasterResultToPngBlob(result);
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
	await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

/**
 * Capture all slides as PNG data URLs.
 *
 * Reuses the same slide-switching and render wait strategy as PDF export so
 * callers can build custom print layouts (handouts, notes pages, etc.). Goes
 * through the clamped-to-cap shared raster path (`renderElementToClampedCanvas`)
 * rather than calling `html2canvas-pro` directly: a print layout draws one
 * image per slide, so it cannot consume tiled output, and this preserves the
 * same `backdrop-filter`/custom-property/3D-transform fidelity every other
 * export format now gets.
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
			console.warn(`[export] Could not find slide stage element for slide ${i}`);
			continue;
		}

		const { canvas } = await renderElementToClampedCanvas(stageEl, scale);
		// Extract data URL immediately so the canvas can be GC'd
		dataUrls.push(canvas.toDataURL('image/png'));
	}

	onProgress?.(totalSlides, totalSlides);
	setActiveSlide(currentSlideIndex);
	return dataUrls;
}
