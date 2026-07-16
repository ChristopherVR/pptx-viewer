/**
 * ExportService: PNG and PDF export for the Angular viewer.
 *
 * Rasterisation is delegated to `renderToCanvas` (an html2canvas-pro wrapper
 * from `../lib/canvas-export`).  PDF assembly uses jsPDF.  Pure logic
 * (orientation, page-size maths, file-name helpers) lives in
 * `./export-helpers` and is tested independently.
 *
 * Provide at the component level so its lifetime tracks the host viewer:
 * `@Component({ providers: [ExportService] })`.
 */

import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import type { PptxData, PptxSaveFormat, PptxSlide, SvgExportOptions } from 'pptx-viewer-core';

import { canvasToJpegData, downloadBlob } from '../internal/shared';
import { renderToCanvas } from '../lib/canvas-export';
import { pdfPageSize, sanitizeFileName } from './export-helpers';
import { exportAllSlidesToSvg, exportSlideToSvg, exportSlideToSvgBlob } from './export-svg';
import { encodeGif, planGifFrames } from './gif-export-helpers';
import type { GifFrame } from './gif-export-helpers';
import { recordWebm } from './video-export-helpers';

/* ------------------------------------------------------------------ */
/*  Internal helpers (DOM only, not exported)                          */
/* ------------------------------------------------------------------ */

/**
 * Convert an HTMLCanvasElement to a JPEG `Uint8Array` immediately, then let
 * the canvas be GC'd.  This keeps peak memory manageable for multi-slide PDFs.
 * Delegates to the shared `canvasToJpegData` and takes its `bytes`.
 *
 * @param canvas  - The rendered slide canvas.
 * @param quality - JPEG quality 0-1 (default 0.92).
 */
function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number = 0.92): Uint8Array {
	return canvasToJpegData(canvas, quality).bytes;
}

/* ------------------------------------------------------------------ */
/*  ExportService                                                       */
/* ------------------------------------------------------------------ */

@Injectable()
export class ExportService {
	private static readonly PRESENTATION_MIME: Record<PptxSaveFormat, string> = {
		pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
		pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
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
		downloadBlob(blob, sanitizeFileName(fileName));
	}

	/**
	 * Rasterize a single DOM element to PNG and trigger a browser download.
	 *
	 * @param el       - The element to capture (e.g. the `.pptx-ng-canvas-stage`).
	 * @param fileName - Suggested download file name (unsafe chars are stripped).
	 * @param scale    - Device-pixel ratio multiplier (default 2 for sharp output).
	 */
	async exportElementToPng(el: HTMLElement, fileName: string, scale: number = 2): Promise<void> {
		const canvas = await renderToCanvas(el, { scale });

		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((b) => {
				if (b) {
					resolve(b);
				} else {
					reject(new Error('[ExportService] canvas.toBlob returned null'));
				}
			}, 'image/png');
		});

		downloadBlob(blob, sanitizeFileName(fileName));
	}

	/** Rasterize an element and copy it to the system clipboard as a PNG image. */
	async copyElementAsPng(el: HTMLElement, scale: number = 2): Promise<void> {
		if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
			throw new Error('[ExportService] Image clipboard is unavailable');
		}

		const canvas = await renderToCanvas(el, { scale });
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((value) => {
				if (value) {
					resolve(value);
				} else {
					reject(new Error('[ExportService] canvas.toBlob returned null'));
				}
			}, 'image/png');
		});

		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
	}

	/**
	 * Rasterize a single element to a canvas (passthrough to html2canvas-pro).
	 * Capture each slide's canvas *while that slide is the live DOM*: the
	 * viewer reuses one stage node, so a deferred capture would yield the same
	 * (last) slide for every page.
	 */
	async renderElement(el: HTMLElement, scale: number = 2): Promise<HTMLCanvasElement> {
		return renderToCanvas(el, { scale });
	}

	/**
	 * Assemble a multi-page PDF from pre-rendered slide canvases (one page per
	 * canvas, sized to the slide aspect ratio in pt) and trigger a download.
	 *
	 * @param canvases     - One canvas per slide, in order, each captured while
	 *                       its slide was the live stage.
	 * @param canvasWidth  - Slide canvas width in pixels (for aspect ratio).
	 * @param canvasHeight - Slide canvas height in pixels (for aspect ratio).
	 * @param fileName     - Suggested download file name (unsafe chars stripped).
	 */
	exportCanvasesToPdf(
		canvases: HTMLCanvasElement[],
		canvasWidth: number,
		canvasHeight: number,
		fileName: string,
	): void {
		if (canvases.length === 0) {
			throw new Error('[ExportService] No slide canvases provided for PDF export');
		}

		const { width: pageW, height: pageH, orientation } = pdfPageSize(canvasWidth, canvasHeight);
		const doc = new jsPDF({ orientation, unit: 'pt', format: [pageW, pageH] });

		for (let i = 0; i < canvases.length; i++) {
			const jpegBytes = canvasToJpegBytes(canvases[i]);
			const imgProps = doc.getImageProperties(jpegBytes);
			const scale = Math.min(pageW / imgProps.width, pageH / imgProps.height);
			const dw = imgProps.width * scale;
			const dh = imgProps.height * scale;
			const dx = (pageW - dw) / 2;
			const dy = (pageH - dh) / 2;

			if (i > 0) {
				doc.addPage([pageW, pageH], orientation);
			}
			doc.addImage(jpegBytes, 'JPEG', dx, dy, dw, dh);
		}

		doc.save(sanitizeFileName(fileName));
	}

	/**
	 * Assemble an animated GIF from pre-rendered slide canvases (one frame per
	 * slide) and trigger a download. Frame delay is derived from
	 * `slideDurationMs` via the pure {@link planGifFrames} planner.
	 *
	 * @param canvases        - One canvas per slide, in order.
	 * @param slideDurationMs - Display time per slide in milliseconds.
	 * @param fileName        - Suggested download file name.
	 */
	exportCanvasesToGif(
		canvases: HTMLCanvasElement[],
		slideDurationMs: number,
		fileName: string,
	): void {
		if (canvases.length === 0) {
			throw new Error('[ExportService] No slide canvases provided for GIF export');
		}
		const plans = planGifFrames({ totalSlides: canvases.length, slideDurationMs });
		const delayCs = plans[0]?.delayCs ?? 200;

		const frames: GifFrame[] = canvases.map((c) => {
			const ctx = c.getContext('2d');
			if (!ctx) {
				throw new Error('[ExportService] 2D context unavailable for GIF frame');
			}
			return {
				imageData: ctx.getImageData(0, 0, c.width, c.height),
				width: c.width,
				height: c.height,
			};
		});

		const bytes = encodeGif(frames, { delayCs });
		const buffer = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(buffer).set(bytes);
		downloadBlob(new Blob([buffer], { type: 'image/gif' }), sanitizeFileName(fileName));
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
		downloadBlob(blob, sanitizeFileName(fileName));
	}
}
