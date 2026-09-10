/**
 * ExportService: PNG, PDF, GIF and video export for the Angular viewer.
 *
 * Rasterisation goes through the shared `foreignObject` fidelity pipeline
 * (`pptx-viewer-shared`'s `rasterizeElement`/`rasterizeElementTiles`/
 * `rasterizeElementTiledToCanvas`, see `export-raster-tiles.ts`), which
 * preserves `backdrop-filter`, CSS custom properties and 3D transforms that
 * `renderToCanvas` (an html2canvas-pro wrapper from `../lib/canvas-export`)
 * cannot; html2canvas-pro is kept only as the documented fallback driver.
 * PDF assembly uses jsPDF. Pure logic (orientation, page-size maths,
 * file-name helpers) lives in `./export-helpers` and is tested independently.
 *
 * Provide at the component level so its lifetime tracks the host viewer:
 * `@Component({ providers: [ExportService] })`.
 */

import { Injectable } from '@angular/core';
import type { PptxData, PptxSaveFormat, PptxSlide, SvgExportOptions } from 'pptx-viewer-core';

import { downloadBlob } from '../internal/shared';
import type { RasterizeElementTilesResult } from '../internal/shared';
import {
	buildTiledPdf,
	renderElementPngBlob,
	renderElementTiled,
	renderElementTilesRaster,
} from './export-raster-tiles';
import { exportAllSlidesToSvg, exportSlideToSvg, exportSlideToSvgBlob } from './export-svg';
import {
	clampGifDimensions,
	encodeGif,
	GIF_POST_CAPTURE_MAX_SIDE,
	planGifFrames,
} from './gif-export-helpers';
import type { GifFrame } from './gif-export-helpers';
import { recordWebm } from './video-export-helpers';

/* ------------------------------------------------------------------ */
/*  ExportService                                                       */
/* ------------------------------------------------------------------ */

@Injectable()
export class ExportService {
	private static readonly PRESENTATION_MIME: Record<PptxSaveFormat, string> = {
		pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
		pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
		ppt: 'application/vnd.ms-powerpoint',
	};

	/** Build a resolution-independent SVG string directly from slide data. */
	exportSlideToSvg(
		slide: PptxSlide,
		width: number,
		height: number,
		options?: SvgExportOptions,
	): string {
		return exportSlideToSvg(slide, width, height, options);
	}

	/** Build an SVG Blob directly from slide data. */
	exportSlideToSvgBlob(
		slide: PptxSlide,
		width: number,
		height: number,
		options?: SvgExportOptions,
	): Blob {
		return exportSlideToSvgBlob(slide, width, height, options);
	}

	/** Build SVG strings for all selected slides in a parsed presentation. */
	exportAllSlidesToSvg(data: PptxData, options?: SvgExportOptions): string[] {
		return exportAllSlidesToSvg(data, options);
	}

	/**
	 * Trigger a browser download of serialized `.pptx` bytes.
	 *
	 * @param bytes    - The serialized presentation (from the viewer's `getContent`).
	 * @param fileName - Suggested download file name (unsafe chars are stripped).
	 */
	savePptx(bytes: Uint8Array, fileName: string): void {
		this.savePresentation(bytes, fileName, 'pptx');
	}

	/** Download serialized presentation bytes using the matching package MIME type. */
	savePresentation(bytes: Uint8Array, fileName: string, format: PptxSaveFormat): void {
		const blob = new Blob([bytes as unknown as BlobPart], {
			type: ExportService.PRESENTATION_MIME[format],
		});
		downloadBlob(blob, fileName);
	}

	/**
	 * Rasterize a single DOM element to PNG and trigger a browser download.
	 *
	 * @param el       - The element to capture (e.g. the `.pptx-ng-canvas-stage`).
	 * @param fileName - Suggested download file name (unsafe chars are stripped).
	 * @param scale    - Device-pixel ratio multiplier (default 2 for sharp output).
	 */
	async exportElementToPng(el: HTMLElement, fileName: string, scale: number = 2): Promise<void> {
		const blob = await this.rasterizeElementToPngBlob(el, scale);
		downloadBlob(blob, fileName);
	}

	/** Rasterize an element and copy it to the system clipboard as a PNG image. */
	async copyElementAsPng(el: HTMLElement, scale: number = 2): Promise<void> {
		if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
			throw new Error('[ExportService] Image clipboard is unavailable');
		}

		const blob = await this.rasterizeElementToPngBlob(el, scale);
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
	}

	/**
	 * Rasterize `el` to a PNG `Blob` via the shared `foreignObject` -> vector-SVG
	 * -> html2canvas fallback chain (preserves backdrop-filter, CSS custom
	 * properties and 3D transforms html2canvas cannot), tiling transparently
	 * for a resolution beyond the browser's canvas cap. Implementation in
	 * `export-raster-tiles.ts`, next to the other shared-driver entry points.
	 */
	private rasterizeElementToPngBlob(el: HTMLElement, scale: number): Promise<Blob> {
		return renderElementPngBlob(el, scale);
	}

	/**
	 * Rasterize a single element to a single full-resolution canvas via the
	 * shared `foreignObject` fidelity pipeline, tiling and stitching
	 * transparently (never reducing the requested scale) so the result is
	 * always one canvas - for GIF/video/print, which can only consume one
	 * image per frame/page. `html2canvas-pro` is kept only as the documented
	 * fallback driver. Capture each slide's canvas *while that slide is the
	 * live DOM*: the viewer reuses one stage node, so a deferred capture would
	 * yield the same (last) slide for every page. Implementation in
	 * `export-raster-tiles.ts` (kept this file under the size budget).
	 */
	async renderElement(el: HTMLElement, scale: number = 2): Promise<HTMLCanvasElement> {
		return renderElementTiled(el, scale);
	}

	/**
	 * Rasterize a single element to its raw per-tile canvases via the shared
	 * `foreignObject` fidelity pipeline, tiling transparently when the
	 * requested resolution exceeds the browser's canvas cap - for PDF pages,
	 * which have no canvas-size limit of their own and so can place several
	 * small tile images instead of needing one oversized canvas.
	 */
	async renderElementToTiles(
		el: HTMLElement,
		scale: number = 2,
	): Promise<RasterizeElementTilesResult> {
		return renderElementTilesRaster(el, scale);
	}

	/**
	 * Assemble a multi-page PDF from pre-rendered per-slide tile sets (one page
	 * per entry) and trigger a download. See `buildTiledPdf` in
	 * `export-raster-tiles.ts` for the full behaviour (placement, degrade to
	 * one-image-per-page for a single-tile slide, cap-escaping rationale).
	 *
	 * @param pages        - One entry per slide, in order, each captured while
	 *                       its slide was the live stage (`renderElementToTiles`).
	 * @param canvasWidth  - Slide canvas width in pixels (for aspect ratio).
	 * @param canvasHeight - Slide canvas height in pixels (for aspect ratio).
	 * @param fileName     - Suggested download file name (unsafe chars stripped).
	 */
	exportTiledPagesToPdf(
		pages: RasterizeElementTilesResult[],
		canvasWidth: number,
		canvasHeight: number,
		fileName: string,
	): void {
		buildTiledPdf(pages, canvasWidth, canvasHeight, fileName);
	}

	/**
	 * Downscale a captured slide canvas to `maxSide` (via the shared
	 * `clampGifDimensions`) and extract its RGBA pixels. GIF encoding cost
	 * grows with pixel count (every pixel is matched against a 256-colour
	 * palette per frame), so every binding bounds its capture before
	 * quantising; see `resolveExportCaptureDecision`'s `postCaptureMaxSide`.
	 */
	private static frameFromCanvas(canvas: HTMLCanvasElement, maxSide: number): GifFrame {
		const { width, height } = clampGifDimensions(canvas.width, canvas.height, maxSide);
		let source = canvas;
		if (width !== canvas.width || height !== canvas.height) {
			const scaled = document.createElement('canvas');
			scaled.width = width;
			scaled.height = height;
			const scaledCtx = scaled.getContext('2d');
			if (!scaledCtx) {
				throw new Error('[ExportService] 2D context unavailable for GIF frame');
			}
			scaledCtx.drawImage(canvas, 0, 0, width, height);
			source = scaled;
		}
		const ctx = source.getContext('2d');
		if (!ctx) {
			throw new Error('[ExportService] 2D context unavailable for GIF frame');
		}
		return { imageData: ctx.getImageData(0, 0, width, height), width, height };
	}

	/**
	 * Assemble an animated GIF from pre-rendered slide canvases (one frame per
	 * slide) and trigger a download. Frame delay is derived from
	 * `slideDurationMs` via the pure {@link planGifFrames} planner. Each
	 * canvas is downscaled to `maxSide` first (see
	 * `resolveExportCaptureDecision`'s `postCaptureMaxSide` for `'gif'`).
	 *
	 * @param canvases        - One canvas per slide, in order.
	 * @param slideDurationMs - Display time per slide in milliseconds.
	 * @param fileName        - Suggested download file name.
	 * @param maxSide         - Longest allowed frame side in pixels after
	 *                          capture. Defaults to `GIF_POST_CAPTURE_MAX_SIDE`.
	 */
	exportCanvasesToGif(
		canvases: HTMLCanvasElement[],
		slideDurationMs: number,
		fileName: string,
		maxSide: number = GIF_POST_CAPTURE_MAX_SIDE,
	): void {
		if (canvases.length === 0) {
			throw new Error('[ExportService] No slide canvases provided for GIF export');
		}
		const plans = planGifFrames({ totalSlides: canvases.length, slideDurationMs });
		const delayCs = plans[0]?.delayCs ?? 200;

		const frames: GifFrame[] = canvases.map((c) => ExportService.frameFromCanvas(c, maxSide));

		const bytes = encodeGif(frames, { delayCs });
		const buffer = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(buffer).set(bytes);
		downloadBlob(new Blob([buffer], { type: 'image/gif' }), fileName);
	}

	/**
	 * Record a WebM video from pre-rendered slide canvases (each held for
	 * `slideDurationMs`) via the browser `MediaRecorder` and trigger a download.
	 *
	 * @param canvases        - One canvas per slide, in order.
	 * @param slideDurationMs - Display time per slide in milliseconds.
	 * @param fileName        - Suggested download file name.
	 * @param signal          - Optional abort signal to cancel recording.
	 * @param onProgress      - Optional per-slide recording progress callback
	 *                          `(currentSlide, totalSlides)`.
	 */
	async exportCanvasesToWebm(
		canvases: HTMLCanvasElement[],
		slideDurationMs: number,
		fileName: string,
		signal?: AbortSignal,
		onProgress?: (current: number, total: number) => void,
	): Promise<void> {
		if (canvases.length === 0) {
			throw new Error('[ExportService] No slide canvases provided for video export');
		}
		const blob = await recordWebm(canvases, { slideDurationMs, signal, onProgress });
		downloadBlob(blob, fileName);
	}
}
