import { downloadDataUrl, exportAbortError } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';

/** Rasterise the slide at `index` to an `HTMLCanvasElement`. Injected so the
 * controller stays DOM-capture-free and unit-testable. */
export type RasterizeSlide = (index: number) => Promise<HTMLCanvasElement>;

/** Per-slide progress callback: `(currentSlideIndex, totalSlides)`. */
export type ExportProgress = (current: number, total: number) => void;

/** Options for the multi-slide PDF export (progress + cooperative cancel). */
export interface ExportPdfOptions {
	/** Capture-phase progress callback: `(currentSlide, totalSlides)`. */
	onProgress?: ExportProgress;
	/** Abort the export early; the loop checks this between slides. */
	signal?: AbortSignal;
}

export interface ExportControllerDeps {
	store: Store<ViewerState>;
	rasterizeSlide: RasterizeSlide;
	/** Base file name (without extension) for downloads. Defaults to `presentation`. */
	fileName?: string;
}

export interface ExportController {
	/** Export a single slide as a PNG download. Defaults to the current slide. */
	exportSlidePng(index?: number): Promise<void>;
	/** Export every slide as a multi-page PDF download (one slide per page). */
	exportPdf(options?: ExportPdfOptions): Promise<void>;
}

function resolveBaseName(fileName: string | undefined): string {
	if (fileName === undefined) {
		return 'presentation';
	}
	const trimmed = fileName.trim().replace(/\.(?:pptx|pdf|png)$/iu, '');
	return trimmed === '' ? 'presentation' : trimmed;
}

/**
 * Export controller: render slides to PNG / PDF. Vanilla port of Vue's
 * `useExport` composable (`packages/vue/src/viewer/composables/useExport.ts`,
 * itself the "viewer-first subset: PNG + PDF; GIF/video deferred" of React's
 * `useExportHandlers`) minus the Vue `Ref`s: a plain closure with an internal
 * `exporting` guard instead of a reactive flag, since nothing in the vanilla
 * binding currently needs to reactively observe export-in-progress state.
 *
 * Rasterisation is delegated to the injected `rasterizeSlide` (the host owns
 * the DOM + `html2canvas-pro`, see `rasterize-slide.ts`). `jspdf` is loaded
 * lazily so it stays out of the main bundle.
 */
export function createExportController(deps: ExportControllerDeps): ExportController {
	let exporting = false;

	async function exportSlidePng(index?: number): Promise<void> {
		const state = deps.store.get();
		const targetIndex = index ?? state.currentSlide;
		if (exporting || targetIndex < 0 || targetIndex >= state.slides.length) {
			return;
		}
		exporting = true;
		try {
			const canvas = await deps.rasterizeSlide(targetIndex);
			downloadDataUrl(
				canvas.toDataURL('image/png'),
				`${resolveBaseName(deps.fileName)}-slide-${targetIndex + 1}.png`,
			);
		} finally {
			exporting = false;
		}
	}

	async function exportPdf(options: ExportPdfOptions = {}): Promise<void> {
		const state = deps.store.get();
		if (exporting || state.slides.length === 0) {
			return;
		}
		const { onProgress, signal } = options;
		exporting = true;
		try {
			const { jsPDF } = await import('jspdf');
			const { width, height } = state.canvasSize;
			const orientation = width >= height ? 'landscape' : 'portrait';
			const pdf = new jsPDF({ orientation, unit: 'px', format: [width, height], compress: true });
			const total = state.slides.length;
			for (let i = 0; i < total; i++) {
				if (signal?.aborted) {
					throw exportAbortError();
				}
				onProgress?.(i, total);
				const canvas = await deps.rasterizeSlide(i);
				if (i > 0) {
					pdf.addPage([width, height], orientation);
				}
				pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
			}
			pdf.save(`${resolveBaseName(deps.fileName)}.pdf`);
		} finally {
			exporting = false;
		}
	}

	return { exportSlidePng, exportPdf };
}
