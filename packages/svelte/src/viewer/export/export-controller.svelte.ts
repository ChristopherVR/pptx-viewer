import type { CanvasSize } from 'pptx-viewer-shared';
import { downloadDataUrl, exportAbortError } from 'pptx-viewer-shared';

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
	/** Live slide count; read fresh on every call. */
	getSlideCount(): number;
	/** Active slide index (0-based); the PNG export's default target. */
	getCurrent(): number;
	/** Live slide canvas size (px), for the PDF page size. */
	getCanvasSize(): CanvasSize;
	rasterizeSlide: RasterizeSlide;
	/** Base file name (without extension) for downloads. Defaults to `presentation`. */
	fileName?: string;
}

function resolveBaseName(fileName: string | undefined): string {
	if (fileName === undefined) {
		return 'presentation';
	}
	const trimmed = fileName.trim().replace(/\.(?:pptx|pdf|png)$/iu, '');
	return trimmed === '' ? 'presentation' : trimmed;
}

/**
 * Export controller (runes class): render slides to PNG / PDF. Svelte port of
 * Vue's `useExport` composable (`packages/vue/src/viewer/composables/
 * useExport.ts`, itself the "viewer-first subset: PNG + PDF; GIF/video
 * deferred" of React's `useExportHandlers`), reshaped as a `$state`-backed
 * class to match this package's runes-class convention (see `EditorState` in
 * `../editor/editor-state.svelte.ts`) rather than Vue `Ref`s.
 *
 * Rasterisation is delegated to the injected `rasterizeSlide` (the host owns
 * the off-screen `SlideStage` mount + `html2canvas-pro`, see
 * `rasterize-slide.ts`). `jspdf` is loaded lazily so it stays out of the main
 * bundle.
 */
export class ExportController {
	/** True while an export is running (disable UI / show a spinner). */
	exporting = $state(false);

	readonly #deps: ExportControllerDeps;

	constructor(deps: ExportControllerDeps) {
		this.#deps = deps;
	}

	/** Export a single slide as a PNG download. Defaults to the current slide. */
	async exportSlidePng(index?: number): Promise<void> {
		const targetIndex = index ?? this.#deps.getCurrent();
		if (this.exporting || targetIndex < 0 || targetIndex >= this.#deps.getSlideCount()) {
			return;
		}
		this.exporting = true;
		try {
			const canvas = await this.#deps.rasterizeSlide(targetIndex);
			downloadDataUrl(
				canvas.toDataURL('image/png'),
				`${resolveBaseName(this.#deps.fileName)}-slide-${targetIndex + 1}.png`,
			);
		} finally {
			this.exporting = false;
		}
	}

	/** Export every slide as a multi-page PDF download (one slide per page). */
	async exportPdf(options: ExportPdfOptions = {}): Promise<void> {
		const total = this.#deps.getSlideCount();
		if (this.exporting || total === 0) {
			return;
		}
		const { onProgress, signal } = options;
		this.exporting = true;
		try {
			const { jsPDF } = await import('jspdf');
			const { width, height } = this.#deps.getCanvasSize();
			const orientation = width >= height ? 'landscape' : 'portrait';
			const pdf = new jsPDF({ orientation, unit: 'px', format: [width, height], compress: true });
			for (let i = 0; i < total; i++) {
				if (signal?.aborted) {
					throw exportAbortError();
				}
				onProgress?.(i, total);
				const canvas = await this.#deps.rasterizeSlide(i);
				if (i > 0) {
					pdf.addPage([width, height], orientation);
				}
				pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
			}
			pdf.save(`${resolveBaseName(this.#deps.fileName)}.pdf`);
		} finally {
			this.exporting = false;
		}
	}
}
