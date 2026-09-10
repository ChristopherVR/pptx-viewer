import type { PptxData } from 'pptx-viewer-core';
import {
	downloadDataUrl,
	exportAbortError,
	exportDeckJson,
	placeTileOnPage,
	rasterResultToPngBlob,
	rasterResultToPngDataUrl,
	resolveExportBaseName,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { ExportGifOptions } from './export-gif';
import { runGifExport } from './export-gif';
import type { PrintOptions } from './export-print';
import { runPrint } from './export-print';
import type {
	ExportCaptureDeps,
	ExportProgress,
	RasterizeSlide,
	RasterizeSlideToRaster,
	RasterizeSlideToTiles,
} from './export-types';
import type { ExportVideoOptions } from './export-video';
import { runVideoExport } from './export-video';

// Re-exported so existing `./export-controller` importers keep working after
// the type moved to `./export-types` (shared with the per-format runners).
export type {
	ExportProgress,
	RasterizeSlide,
	RasterizeSlideToRaster,
	RasterizeSlideToTiles,
} from './export-types';

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
	/** PNG-export / "copy slide as image" only; see {@link RasterizeSlideToRaster}. */
	rasterizeSlideToRaster?: RasterizeSlideToRaster;
	/** PDF export only; see {@link RasterizeSlideToTiles}. */
	rasterizeSlideToTiles?: RasterizeSlideToTiles;
	/** Base file name (without extension) for downloads. Defaults to `presentation`. */
	fileName?: string;
	/** Live translator (host-supplied), for the print path's own UI text. */
	getTranslator?: ExportCaptureDeps['getTranslator'];
	/** Options > Advanced > "Print hidden slides". */
	getIncludeHiddenSlides?: ExportCaptureDeps['getIncludeHiddenSlides'];
	/** Options > Advanced > "High quality" raster scale for the print fallback path. */
	getPrintHighQuality?: ExportCaptureDeps['getPrintHighQuality'];
}

export interface ExportController {
	/** Export a single slide as a PNG download. Defaults to the current slide. */
	exportSlidePng(index?: number): Promise<void>;
	/** Copy a slide to the system clipboard as a PNG image. */
	copySlideAsImage(index?: number): Promise<void>;
	/** Export every slide as a multi-page PDF download (one slide per page). */
	exportPdf(options?: ExportPdfOptions): Promise<void>;
	/** Export every slide as an animated GIF download (one frame per slide). */
	exportGif(options?: ExportGifOptions): Promise<void>;
	/** Export every slide as a WebM video download (MediaRecorder). */
	exportVideo(options?: ExportVideoOptions): Promise<void>;
	/** Assemble the printable document and open it in a print window. */
	print(options?: PrintOptions): Promise<boolean>;
	/** Serialize the deck to `pptx-viewer-json` and download it. */
	exportJson(): void;
}

/**
 * Assemble the live {@link PptxData} for the deck-JSON export from the store
 * (the store, not the load-time handler, is the source of truth once edits
 * land). Mirrors the AI bridge's `readDeckData` seam: fields the vanilla state
 * does not track are simply omitted from the JSON.
 */
function deckDataFromState(state: ViewerState): PptxData {
	return {
		slides: state.slides,
		width: state.canvasSize.width,
		height: state.canvasSize.height,
		sections: state.sections,
		presentationProperties: state.presentationProperties,
		headerFooter: state.headerFooter,
		coreProperties: state.coreProperties,
		appProperties: state.appProperties,
		customProperties: state.customProperties,
		customShows: state.customShows,
		embeddedFonts: state.embeddedFonts,
		slideMasters: state.slideMasters,
		themeOptions: state.themeOptions,
		notesMaster: state.notesMaster,
		handoutMaster: state.handoutMaster,
		hasMacros: state.hasMacros,
		tableStyleMap: state.tableStyleMap,
		tableStylesDefaultId: state.tableStylesDefaultId,
		tags: state.tagCollections,
		theme:
			state.colorScheme || state.fontScheme || state.themeName
				? {
						name: state.themeName,
						colorScheme: state.colorScheme,
						fontScheme: state.fontScheme,
					}
				: undefined,
	};
}

/**
 * Export controller: render slides to PNG / PDF / GIF / WebM video, plus the
 * print flow. Vanilla port of Vue's `useExport` composable extended with the
 * GIF/video/print surface from React's `useExportHandlers` (the per-format
 * capture drivers live in `export-gif.ts` / `export-video.ts` /
 * `export-print.ts`; all pure planning/encoding/assembly is shared). A plain
 * closure with an internal `exporting` guard replaces the reactive flag, since
 * nothing in the vanilla binding currently needs to reactively observe
 * export-in-progress state.
 *
 * Rasterisation is delegated to the injected `rasterizeSlide` (the host owns
 * the DOM + `html2canvas-pro`, see `rasterize-slide.ts`). `jspdf` is loaded
 * lazily so it stays out of the main bundle.
 */
export function createExportController(deps: ExportControllerDeps): ExportController {
	let exporting = false;

	const capture: ExportCaptureDeps = {
		store: deps.store,
		rasterizeSlide: deps.rasterizeSlide,
		rasterizeSlideToRaster: deps.rasterizeSlideToRaster,
		baseName: resolveExportBaseName(deps.fileName),
		getTranslator: deps.getTranslator,
		getIncludeHiddenSlides: deps.getIncludeHiddenSlides,
		getPrintHighQuality: deps.getPrintHighQuality,
	};

	/** Run one export at a time; a call while one is in flight gets `fallback`. */
	async function guarded<T>(fallback: T, run: () => Promise<T>): Promise<T> {
		if (exporting) {
			return fallback;
		}
		exporting = true;
		try {
			return await run();
		} finally {
			exporting = false;
		}
	}

	/**
	 * `deps.rasterizeSlideToRaster` when the host supplied one (the real
	 * viewer always does; see `export-lifecycle.ts`), else `rasterizeSlide`'s
	 * plain canvas wrapped as a `RasterizeElementResult` so PNG-export/copy
	 * fixtures that only ever configured `rasterizeSlide` keep working.
	 */
	async function captureRaster(index: number) {
		if (deps.rasterizeSlideToRaster) {
			return deps.rasterizeSlideToRaster(index);
		}
		const canvas = await deps.rasterizeSlide(index);
		return {
			kind: 'canvas' as const,
			canvas,
			strategy: 'html2canvas' as const,
			width: canvas.width,
			height: canvas.height,
		};
	}

	async function exportSlidePng(index?: number): Promise<void> {
		const state = deps.store.get(),
			targetIndex = index ?? state.currentSlide;
		if (targetIndex < 0 || targetIndex >= state.slides.length) {
			return;
		}
		return guarded(undefined, async () => {
			const result = await captureRaster(targetIndex);
			downloadDataUrl(
				await rasterResultToPngDataUrl(result),
				`${capture.baseName}-slide-${targetIndex + 1}.png`,
			);
		});
	}

	async function copySlideAsImage(index?: number): Promise<void> {
		const state = deps.store.get(),
			targetIndex = index ?? state.currentSlide;
		if (
			targetIndex < 0 ||
			targetIndex >= state.slides.length ||
			typeof ClipboardItem === 'undefined' ||
			!navigator.clipboard?.write
		) {
			return;
		}
		return guarded(undefined, async () => {
			const result = await captureRaster(targetIndex),
				blob = await rasterResultToPngBlob(result);
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
		});
	}

	async function exportPdf(options: ExportPdfOptions = {}): Promise<void> {
		const state = deps.store.get();
		if (state.slides.length === 0) {
			return;
		}
		// eslint-disable-next-line one-var -- separated from `state` above by a guard clause
		const { onProgress, signal } = options;
		return guarded(undefined, async () => {
			const { jsPDF } = await import('jspdf'),
				{ width, height } = state.canvasSize,
				orientation = width >= height ? 'landscape' : 'portrait',
				pdf = new jsPDF({ orientation, unit: 'px', format: [width, height], compress: true }),
				total = state.slides.length;
			for (let i = 0; i < total; i++) {
				if (signal?.aborted) {
					throw exportAbortError();
				}
				onProgress?.(i, total);
				if (i > 0) {
					pdf.addPage([width, height], orientation);
				}
				if (deps.rasterizeSlideToTiles) {
					// One `addImage` per tile, placed at its proportional position
					// on the native-size page: escapes the browser canvas cap for
					// a page whose export resolution would otherwise exceed it. A
					// single-tile slide degrades to exactly one full-page image.
					const tilesResult = await deps.rasterizeSlideToTiles(i);
					for (const tile of tilesResult.tiles) {
						const placement = placeTileOnPage(
							tile,
							tilesResult.fullWidth,
							tilesResult.fullHeight,
							width,
							height,
						);
						pdf.addImage(
							tile.canvas.toDataURL('image/png'),
							'PNG',
							placement.x,
							placement.y,
							placement.width,
							placement.height,
						);
					}
				} else {
					const canvas = await deps.rasterizeSlide(i);
					pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
				}
			}
			pdf.save(`${capture.baseName}.pdf`);
		});
	}

	/**
	 * Deck-as-JSON export: pure serialization of the live state, no
	 * rasterisation, so it neither needs nor takes the single-export guard.
	 * The shared helper derives `deck.json` from the raw source file name.
	 */
	function exportJson(): void {
		exportDeckJson(deckDataFromState(deps.store.get()), deps.fileName);
	}

	return {
		exportSlidePng,
		copySlideAsImage,
		exportPdf,
		exportJson,
		exportGif: (options) => guarded(undefined, () => runGifExport(capture, options)),
		exportVideo: (options) => guarded(undefined, () => runVideoExport(capture, options)),
		print: (options) => guarded(false, () => runPrint(capture, options)),
	};
}
