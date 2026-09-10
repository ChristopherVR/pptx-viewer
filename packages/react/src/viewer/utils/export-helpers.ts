/**
 * Shared types and helper functions used by the export sub-modules.
 *
 * The browser download primitives (`downloadBlob`, `downloadDataUrl`) now live
 * once in `pptx-viewer-shared` (`export/download-helpers`); they are re-exported
 * here to preserve the historical `./export-helpers` import path. These do NOT
 * sanitize the filename (callers pass a known-safe name): the sanitizing variant
 * lives in `dom-helpers`.
 */
import {
	downloadBlob,
	downloadDataUrl,
	rasterizeElement,
	rasterizeElementTiledToCanvas,
	rasterizeElementTiles,
	rasterResultToPngBlob,
	rasterResultToPngDataUrl,
} from 'pptx-viewer-shared';
import type {
	RasterizeElementOptions,
	RasterizeElementResult,
	RasterizeElementTiledCanvasResult,
	RasterizeElementTilesResult,
} from 'pptx-viewer-shared';

import { renderToCanvas } from '../../lib/canvas-export';

export { downloadBlob, downloadDataUrl, rasterResultToPngBlob, rasterResultToPngDataUrl };
export type { RasterizeElementResult, RasterizeElementTilesResult } from 'pptx-viewer-shared';

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
	/** AbortSignal to cancel the export. */
	signal?: AbortSignal;
}

/** Options for notes-page PDF export. */
export interface NotesPdfExportOptions {
	/** Render scale multiplier for each slide capture (default 2). */
	scale?: number;
	/** Progress callback: (currentSlide, totalSlides). */
	onProgress?: ExportProgressCallback;
	/** AbortSignal to cancel the export. */
	signal?: AbortSignal;
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

/** Raster mode: `'auto'` runs the full fallback chain; `'html2canvas'` skips straight to the legacy driver. */
export type RasterMode = NonNullable<RasterizeElementOptions['mode']>;

/**
 * The `ignoreElements` predicate every `html2canvas-pro` call site here needs:
 * skip selection overlays / snap lines so they never leak into an export.
 */
export function ignoreExportOverlayElements(el: Element): boolean {
	const htmlEl = el as HTMLElement;
	if (htmlEl.dataset?.exportIgnore === 'true') {
		return true;
	}
	return Boolean(
		htmlEl.classList?.contains('pointer-events-none') &&
		(htmlEl.classList.contains('z-50') || htmlEl.classList.contains('z-[60]')),
	);
}

/**
 * The element's natural (1x) CSS-pixel size the shared driver rasterises at.
 * `offsetWidth`/`offsetHeight` cover an element whose client rect is empty
 * (e.g. detached or `display: contents` wrappers in tests).
 */
function measureNaturalSize(element: HTMLElement): { width: number; height: number } {
	const rect = element.getBoundingClientRect();
	return {
		width: rect.width || element.offsetWidth,
		height: rect.height || element.offsetHeight,
	};
}

/**
 * The one place React maps its `html2canvas-pro` driver (`renderToCanvas`)
 * onto the shared driver's option shape. The shared pipeline asks for one
 * *window* at a time (`sourceRect` in CSS px, `outputSize` in device px), so
 * the html2canvas scale is derived per call rather than from the export
 * scale, which is what makes a tiled fallback render the right sub-rect.
 */
function buildRasterOptions(
	element: HTMLElement,
	scale: number,
	backgroundColor: string | undefined,
	mode: RasterMode,
): RasterizeElementOptions {
	return {
		scale,
		backgroundColor,
		mode,
		html2canvasFallback: (sourceRect, outputSize) =>
			renderToCanvas(element, {
				scale: outputSize.width / (sourceRect.width || 1),
				x: sourceRect.x,
				y: sourceRect.y,
				width: sourceRect.width,
				height: sourceRect.height,
				useCORS: true,
				allowTaint: true,
				backgroundColor: backgroundColor ?? null,
				logging: false,
				ignoreElements: ignoreExportOverlayElements,
			}),
	};
}

/**
 * Render an HTML element to a raster image via the shared
 * `foreignObject` -> vector-SVG -> html2canvas fallback chain
 * (`pptx-viewer-shared`'s `rasterizeElement`), tiling transparently when the
 * requested scale would exceed the browser's canvas-dimension cap.
 *
 * Prefer this (or {@link renderElementToTiledCanvas} /
 * {@link renderElementToTiles}) over calling `html2canvas-pro` directly: it
 * preserves `backdrop-filter`, CSS custom properties and 3D transforms that
 * html2canvas cannot, and produces pre-encoded PNG bytes instead of failing
 * or silently clipping once the requested resolution exceeds what any single
 * `<canvas>` can hold. `html2canvas-pro` is kept only as the documented
 * last-resort driver (`mode: 'html2canvas'` skips straight to it).
 */
export async function renderElementToRaster(
	element: HTMLElement,
	scale: number = 2,
	backgroundColor?: string,
	mode: RasterMode = 'auto',
): Promise<RasterizeElementResult> {
	const { width, height } = measureNaturalSize(element);
	return rasterizeElement(
		element,
		width,
		height,
		element.ownerDocument,
		buildRasterOptions(element, scale, backgroundColor, mode),
	);
}

/**
 * Render an HTML element to its raw per-tile canvases via the shared
 * `foreignObject` -> vector-SVG -> html2canvas fallback chain
 * (`pptx-viewer-shared`'s `rasterizeElementTiles`), tiling transparently when
 * the requested scale would exceed the browser's canvas-dimension cap.
 *
 * Prefer this over {@link renderElementToRaster} for a caller that can place
 * several images itself (PDF pages, which have no canvas-size limit of their
 * own): each tile stays individually small (within the probed cap), so a PDF
 * export escapes the cap without ever stitching a PNG.
 */
export async function renderElementToTiles(
	element: HTMLElement,
	scale: number = 2,
	backgroundColor?: string,
	mode: RasterMode = 'auto',
): Promise<RasterizeElementTilesResult> {
	const { width, height } = measureNaturalSize(element);
	return rasterizeElementTiles(
		element,
		width,
		height,
		element.ownerDocument,
		buildRasterOptions(element, scale, backgroundColor, mode),
	);
}

/**
 * Render an HTML element to a single, full-resolution canvas via the shared
 * `foreignObject` fidelity pipeline, tiling and stitching transparently
 * (`putImageData`, never downscaling) when the requested resolution would
 * exceed the browser's canvas cap. For a caller that needs one `<canvas>`
 * rather than tiled output: GIF frames (`getImageData`), a `captureStream()`
 * recording canvas (`drawImage`), and the notes-PDF / print-capture layouts,
 * which each draw exactly one image per page, not a tile grid.
 */
export async function renderElementToTiledCanvas(
	element: HTMLElement,
	scale: number = 2,
	backgroundColor?: string,
	mode: RasterMode = 'auto',
): Promise<RasterizeElementTiledCanvasResult> {
	const { width, height } = measureNaturalSize(element);
	return rasterizeElementTiledToCanvas(
		element,
		width,
		height,
		element.ownerDocument,
		buildRasterOptions(element, scale, backgroundColor, mode),
	);
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
