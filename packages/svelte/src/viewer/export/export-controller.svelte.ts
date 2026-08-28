import type { PptxData, PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import {
	downloadBlob,
	downloadDataUrl,
	exportAbortError,
	exportDeckJson,
	resolveExportBaseName,
} from 'pptx-viewer-shared';

import type { ExportGifOptions } from './export-gif';
import { exportSlidesToGifBlob } from './export-gif';
import type { OpenPrintWindow, PrintOptions } from './export-print';
import { printSlides } from './export-print';
import type { ExportVideoOptions } from './export-video';
import { exportSlidesToWebmBlob } from './export-video';

/** Rasterise the slide at `index` to an `HTMLCanvasElement`. Injected so the
 * controller stays DOM-capture-free and unit-testable. */
export type RasterizeSlide = (
	index: number,
	scaleMultiplier?: number,
) => Promise<HTMLCanvasElement>;

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
	/** Live slide list (print needs slide notes/titles, not just the count). */
	getSlides(): PptxSlide[];
	rasterizeSlide: RasterizeSlide;
	/** Print-surface opener override; see `export-print.ts` for the default. */
	openPrintWindow?: OpenPrintWindow;
	/** Base file name (without extension) for downloads. Defaults to `presentation`. */
	fileName?: string;
	/** Live presentation data for the deck-JSON export; undefined before a load. */
	getDeckData?(): PptxData | undefined;
	/** Source file name for the deck-JSON download (`deck.pptx` -> `deck.json`). */
	getFileName?(): string | undefined;
	/** Options > Advanced > "Print hidden slides". Defaults to `false` (excluded). */
	getIncludeHiddenSlides?(): boolean;
	/** Options > Advanced > "High quality" raster scale for the print fallback path. */
	getPrintHighQuality?(): boolean;
}

/**
 * Export controller (runes class): render slides to PNG / PDF / animated GIF /
 * WebM video, plus the print flow. Started as a Svelte port of Vue's
 * `useExport` composable (`packages/vue/src/viewer/composables/useExport.ts`)
 * and now also covers React's `useExportHandlers` GIF/video surface (via
 * `export-gif.ts` / `export-video.ts`) and Vue's `usePrint`
 * (`export-print.ts`), reshaped as a `$state`-backed class to match this
 * package's runes-class convention (see `EditorState` in
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
				`${resolveExportBaseName(this.#deps.fileName)}-slide-${targetIndex + 1}.png`,
			);
		} finally {
			this.exporting = false;
		}
	}

	/** Copy a slide to the system clipboard as a PNG image. */
	async copySlideAsImage(index?: number): Promise<void> {
		const targetIndex = index ?? this.#deps.getCurrent();
		if (
			this.exporting ||
			targetIndex < 0 ||
			targetIndex >= this.#deps.getSlideCount() ||
			typeof ClipboardItem === 'undefined' ||
			!navigator.clipboard?.write
		) {
			return;
		}
		this.exporting = true;
		try {
			const canvas = await this.#deps.rasterizeSlide(targetIndex),
				blob = await new Promise<Blob | null>((resolve) => {
					canvas.toBlob(resolve, 'image/png');
				});
			if (blob) {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			}
		} finally {
			this.exporting = false;
		}
	}

	/**
	 * Serialize the live deck to `pptx-viewer-json` and trigger the download.
	 * Pure data serialization (shared `exportDeckJson`): synchronous, no
	 * rasterization pipeline, no progress modal, no `exporting` toggle.
	 */
	exportJson(): void {
		const data = this.#deps.getDeckData?.();
		if (!data) {
			return;
		}
		exportDeckJson(data, this.#deps.getFileName?.() ?? this.#deps.fileName ?? null);
	}

	/** Export every slide as a multi-page PDF download (one slide per page). */
	async exportPdf(options: ExportPdfOptions = {}): Promise<void> {
		const total = this.#deps.getSlideCount();
		if (this.exporting || total === 0) {
			return;
		}
		// eslint-disable-next-line one-var -- separated from `total` above by a guard clause
		const { onProgress, signal } = options;
		this.exporting = true;
		try {
			const { jsPDF } = await import('jspdf'),
				{ width, height } = this.#deps.getCanvasSize(),
				orientation = width >= height ? 'landscape' : 'portrait',
				pdf = new jsPDF({ orientation, unit: 'px', format: [width, height], compress: true });
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
			pdf.save(`${resolveExportBaseName(this.#deps.fileName)}.pdf`);
		} finally {
			this.exporting = false;
		}
	}

	/**
	 * Export every slide as an animated GIF download. Frame delays come from
	 * the shared `planGifFrames` plan (default duration + per-slide overrides);
	 * see `export-gif.ts`. Supports progress + AbortSignal like `exportPdf`.
	 */
	async exportGif(options: ExportGifOptions = {}): Promise<void> {
		if (this.exporting || this.#deps.getSlideCount() === 0) {
			return;
		}
		this.exporting = true;
		try {
			const blob = await exportSlidesToGifBlob(
				{
					getSlideCount: () => this.#deps.getSlideCount(),
					rasterizeSlide: (index) => this.#deps.rasterizeSlide(index),
				},
				options,
			);
			downloadBlob(blob, `${resolveExportBaseName(this.#deps.fileName)}.gif`);
		} finally {
			this.exporting = false;
		}
	}

	/**
	 * Export every slide as a WebM video download (MediaRecorder over a canvas
	 * capture stream, timing from the shared `planVideoSegments` plan); see
	 * `export-video.ts`. Supports progress + AbortSignal like `exportPdf`.
	 */
	async exportVideo(options: ExportVideoOptions = {}): Promise<void> {
		if (this.exporting || this.#deps.getSlideCount() === 0) {
			return;
		}
		this.exporting = true;
		try {
			const blob = await exportSlidesToWebmBlob(
				{
					getSlideCount: () => this.#deps.getSlideCount(),
					rasterizeSlide: (index) => this.#deps.rasterizeSlide(index),
				},
				options,
			);
			downloadBlob(blob, `${resolveExportBaseName(this.#deps.fileName)}.webm`);
		} finally {
			this.exporting = false;
		}
	}

	/**
	 * Assemble the shared print document for the given (partial) settings and
	 * open it in the print surface (hidden iframe by default; see
	 * `export-print.ts` for the popup-blocker caveats of custom openers).
	 * Resolves `true` when the print surface opened.
	 */
	async print(options: PrintOptions = {}): Promise<boolean> {
		if (this.exporting || this.#deps.getSlides().length === 0) {
			return false;
		}
		this.exporting = true;
		try {
			return await printSlides(
				{
					getSlides: () => this.#deps.getSlides(),
					getCurrent: () => this.#deps.getCurrent(),
					getCanvasSize: () => this.#deps.getCanvasSize(),
					rasterizeSlide: (index, scaleMultiplier) =>
						this.#deps.rasterizeSlide(index, scaleMultiplier),
					openPrintWindow: this.#deps.openPrintWindow,
					getIncludeHiddenSlides: this.#deps.getIncludeHiddenSlides,
					getPrintHighQuality: this.#deps.getPrintHighQuality,
				},
				options,
			);
		} finally {
			this.exporting = false;
		}
	}
}
