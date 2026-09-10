/**
 * Tile-aware rasterisation + tiled-PDF assembly, split out of
 * `export.service.ts` to keep that file under the file-size budget.
 *
 * Every raster entry point here goes through the shared `foreignObject`
 * fidelity pipeline (`pptx-viewer-shared`'s `rasterizeElement` /
 * `rasterizeElementClampedToCanvas` / `rasterizeElementTiles`), with
 * `html2canvas-pro` kept only as the documented fallback driver. This is the
 * one place in the Angular binding that touches that driver directly.
 */
import { jsPDF } from 'jspdf';

import {
	canvasToJpegData,
	placeTileOnPage,
	rasterizeElement,
	rasterizeElementClampedToCanvas,
	rasterizeElementTiles,
	rasterResultToPngBlob,
	sanitizeDownloadFilename,
} from '../internal/shared';
import type {
	RasterOutputSize,
	RasterSourceRect,
	RasterizeElementTilesResult,
} from '../internal/shared';
import { renderToCanvas } from '../lib/canvas-export';
import { pdfPageSize } from './export-helpers';

/**
 * The `html2canvasFallback` driver every shared rasterize call needs, bound
 * to one element, so the html2canvas-pro adapter is written once, not
 * hand-copied per raster entry point.
 */
export function html2canvasFallbackFor(
	el: HTMLElement,
): (sourceRect: RasterSourceRect, outputSize: RasterOutputSize) => Promise<HTMLCanvasElement> {
	return (sourceRect, outputSize) =>
		renderToCanvas(el, {
			scale: outputSize.width / (sourceRect.width || 1),
			x: sourceRect.x,
			y: sourceRect.y,
			width: sourceRect.width,
			height: sourceRect.height,
		});
}

/** The element's natural (1x) CSS-pixel size the shared rasterizers scale from. */
function naturalSizeOf(el: HTMLElement): { width: number; height: number } {
	const rect = el.getBoundingClientRect();
	return { width: rect.width || el.offsetWidth, height: rect.height || el.offsetHeight };
}

/**
 * Rasterize `el` to a PNG `Blob` via the shared `foreignObject` -> vector-SVG
 * -> html2canvas fallback chain (preserves backdrop-filter, CSS custom
 * properties and 3D transforms html2canvas cannot), tiling transparently
 * for a resolution beyond the browser's canvas cap - for PNG download and
 * "copy slide as image", whose PNG encoder can consume tiled output.
 */
export async function renderElementPngBlob(el: HTMLElement, scale: number = 2): Promise<Blob> {
	const { width, height } = naturalSizeOf(el);
	const result = await rasterizeElement(el, width, height, el.ownerDocument, {
		scale,
		html2canvasFallback: html2canvasFallbackFor(el),
	});
	return rasterResultToPngBlob(result);
}

/**
 * Rasterize a single element to a canvas via the shared `foreignObject`
 * fidelity pipeline, clamped (scale reduced, never tiled) so the result is
 * always one canvas - for GIF/video/print, which can only consume one image
 * per frame/page. Capture each slide's canvas *while that slide is the live
 * DOM*: the viewer reuses one stage node, so a deferred capture would yield
 * the same (last) slide for every page.
 */
export async function renderElementClamped(
	el: HTMLElement,
	scale: number = 2,
): Promise<HTMLCanvasElement> {
	const { width, height } = naturalSizeOf(el);
	const result = await rasterizeElementClampedToCanvas(el, width, height, el.ownerDocument, {
		scale,
		html2canvasFallback: html2canvasFallbackFor(el),
	});
	return result.canvas;
}

/**
 * Rasterize a single element to its raw per-tile canvases via the shared
 * `foreignObject` fidelity pipeline, tiling transparently when the requested
 * resolution exceeds the browser's canvas cap - for PDF pages, which have no
 * canvas-size limit of their own and so can place several small tile images
 * instead of needing one oversized canvas.
 */
export async function renderElementTilesRaster(
	el: HTMLElement,
	scale: number = 2,
): Promise<RasterizeElementTilesResult> {
	const { width, height } = naturalSizeOf(el);
	return rasterizeElementTiles(el, width, height, el.ownerDocument, {
		scale,
		html2canvasFallback: html2canvasFallbackFor(el),
	});
}

/**
 * Assemble a multi-page PDF from pre-rendered per-slide tile sets (one page
 * per entry) and trigger a download. Each tile is placed at its proportional
 * position on the page (`placeTileOnPage`); a single-tile slide (the
 * overwhelming majority) degrades to exactly one full-page image per page,
 * unchanged from before tiling existed. Escapes the browser canvas cap:
 * every tile is individually small, and a PDF page has no canvas-size limit
 * of its own.
 *
 * @param pages        - One entry per slide, in order, each captured while
 *                       its slide was the live stage (`renderElementTilesRaster`).
 * @param canvasWidth  - Slide canvas width in pixels (for aspect ratio).
 * @param canvasHeight - Slide canvas height in pixels (for aspect ratio).
 * @param fileName     - Suggested download file name (unsafe chars stripped).
 */
export function buildTiledPdf(
	pages: RasterizeElementTilesResult[],
	canvasWidth: number,
	canvasHeight: number,
	fileName: string,
): void {
	if (pages.length === 0) {
		throw new Error('[ExportService] No slide pages provided for PDF export');
	}

	const { width: pageW, height: pageH, orientation } = pdfPageSize(canvasWidth, canvasHeight);
	const doc = new jsPDF({ orientation, unit: 'pt', format: [pageW, pageH] });

	for (let i = 0; i < pages.length; i++) {
		if (i > 0) {
			doc.addPage([pageW, pageH], orientation);
		}
		const { fullWidth, fullHeight, tiles } = pages[i];
		for (const tile of tiles) {
			const jpegBytes = canvasToJpegData(tile.canvas, 0.92).bytes;
			const placement = placeTileOnPage(tile, fullWidth, fullHeight, pageW, pageH);
			doc.addImage(jpegBytes, 'JPEG', placement.x, placement.y, placement.width, placement.height);
		}
	}

	doc.save(sanitizeDownloadFilename(fileName));
}
