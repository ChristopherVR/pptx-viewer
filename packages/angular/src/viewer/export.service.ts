/**
 * ExportService — PNG and PDF export for the Angular viewer.
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

import { renderToCanvas } from '../lib/canvas-export';
import { pdfPageSize, sanitizeFileName } from './export-helpers';
import { encodeGif, planGifFrames } from './gif-export-helpers';
import type { GifFrame } from './gif-export-helpers';
import { recordWebm } from './video-export-helpers';

/* ------------------------------------------------------------------ */
/*  Internal helpers (DOM only — not exported)                          */
/* ------------------------------------------------------------------ */

/**
 * Trigger a browser download for a Blob.
 *
 * @param blob     - The content to download.
 * @param fileName - The suggested file name shown to the user.
 */
function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = sanitizeFileName(fileName);
	anchor.style.display = 'none';
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	// Revoke asynchronously so the download has time to start.
	setTimeout(() => {
		URL.revokeObjectURL(url);
	}, 10_000);
}

/**
 * Convert an HTMLCanvasElement to a JPEG `Uint8Array` immediately, then let
 * the canvas be GC'd.  This keeps peak memory manageable for multi-slide PDFs.
 *
 * @param canvas  - The rendered slide canvas.
 * @param quality - JPEG quality 0–1 (default 0.92).
 */
function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number = 0.92): Uint8Array {
	const dataUrl = canvas.toDataURL('image/jpeg', quality);
	const base64 = dataUrl.split(',')[1] ?? '';
	const raw = atob(base64);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) {
		bytes[i] = raw.charCodeAt(i);
	}
	return bytes;
}

/* ------------------------------------------------------------------ */
/*  ExportService                                                       */
/* ------------------------------------------------------------------ */

@Injectable()
export class ExportService {
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

	/**
	 * Rasterize a single element to a canvas (passthrough to html2canvas-pro).
	 * Capture each slide's canvas *while that slide is the live DOM* — the
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
	 */
	async exportCanvasesToWebm(
		canvases: HTMLCanvasElement[],
		slideDurationMs: number,
		fileName: string,
		signal?: AbortSignal,
	): Promise<void> {
		if (canvases.length === 0) {
			throw new Error('[ExportService] No slide canvases provided for video export');
		}
		const blob = await recordWebm(canvases, { slideDurationMs, signal });
		downloadBlob(blob, sanitizeFileName(fileName));
	}
}
