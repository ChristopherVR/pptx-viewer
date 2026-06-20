import type { PptxSlide } from 'pptx-viewer-core';
import { exportAbortError } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

import type { CanvasSize } from '../types';

/**
 * Rasterise the slide at `index` to an `HTMLCanvasElement`. The host supplies
 * this (it owns the DOM + the `html2canvas-pro` integration); keeping it
 * injected makes `useExport` DOM-free and unit-testable.
 */
export type RasterizeSlide = (index: number) => Promise<HTMLCanvasElement>;

export interface UseExportOptions {
	slides: Ref<PptxSlide[]>;
	canvasSize: Ref<CanvasSize>;
	rasterizeSlide: RasterizeSlide;
	/** Base file name (without extension) for downloads. Defaults to `presentation`. */
	fileName?: Ref<string> | string;
}

/** Per-slide progress callback: `(currentSlideIndex, totalSlides)`. */
export type ExportProgress = (current: number, total: number) => void;

/** Options for the multi-slide PDF export (progress + cooperative cancel). */
export interface ExportPdfOptions {
	/** Capture-phase progress callback: `(currentSlide, totalSlides)`. */
	onProgress?: ExportProgress;
	/** Abort the export early; the loop checks this between slides. */
	signal?: AbortSignal;
}

export interface UseExportResult {
	/** True while an export is running (disable UI / show a spinner). */
	exporting: Ref<boolean>;
	/** Export a single slide as a PNG download. Defaults to the given index. */
	exportSlidePng: (index: number) => Promise<void>;
	/** Export every slide as a multi-page PDF (one slide per page). */
	exportPdf: (options?: ExportPdfOptions) => Promise<void>;
}

/** Trigger a browser download for a data URL. */
function downloadDataUrl(dataUrl: string, fileName: string): void {
	const link = document.createElement('a');
	link.href = dataUrl;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
}

function resolveBaseName(fileName: UseExportOptions['fileName']): string {
	if (fileName === undefined) {
		return 'presentation';
	}
	const value = typeof fileName === 'string' ? fileName : fileName.value;
	const trimmed = value.trim().replace(/\.(?:pptx|pdf|png)$/iu, '');
	return trimmed === '' ? 'presentation' : trimmed;
}

/**
 * Export composable: render slides to PNG / PDF.
 *
 * Rasterisation is delegated to the injected `rasterizeSlide` (the host wires
 * `html2canvas-pro` over an off-screen slide stage). `jspdf` is loaded lazily so
 * it stays out of the main chunk. Vue port of the React `useExportHandlers`
 * (viewer-first subset: PNG + PDF; GIF/video deferred).
 */
export function useExport(options: UseExportOptions): UseExportResult {
	const { slides, canvasSize, rasterizeSlide } = options;
	const exporting = ref(false);

	async function exportSlidePng(index: number): Promise<void> {
		if (exporting.value || index < 0 || index >= slides.value.length) {
			return;
		}
		exporting.value = true;
		try {
			const canvas = await rasterizeSlide(index);
			downloadDataUrl(
				canvas.toDataURL('image/png'),
				`${resolveBaseName(options.fileName)}-slide-${index + 1}.png`,
			);
		} finally {
			exporting.value = false;
		}
	}

	async function exportPdf(opts: ExportPdfOptions = {}): Promise<void> {
		if (exporting.value || slides.value.length === 0) {
			return;
		}
		const { onProgress, signal } = opts;
		exporting.value = true;
		try {
			const { jsPDF } = await import('jspdf');
			const { width, height } = canvasSize.value;
			const orientation = width >= height ? 'landscape' : 'portrait';
			const pdf = new jsPDF({ orientation, unit: 'px', format: [width, height], compress: true });
			const total = slides.value.length;
			for (let i = 0; i < total; i++) {
				if (signal?.aborted) {
					throw exportAbortError();
				}
				onProgress?.(i, total);
				const canvas = await rasterizeSlide(i);
				if (i > 0) {
					pdf.addPage([width, height], orientation);
				}
				pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
			}
			pdf.save(`${resolveBaseName(options.fileName)}.pdf`);
		} finally {
			exporting.value = false;
		}
	}

	return { exporting, exportSlidePng, exportPdf };
}
