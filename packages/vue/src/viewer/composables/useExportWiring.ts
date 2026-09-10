import type { PptxData, PptxSaveFormat, PptxSlide } from 'pptx-viewer-core';
import type {
	CanvasSize,
	RasterizeElementResult,
	RasterizeElementTilesResult,
	ViewerOptions,
} from 'pptx-viewer-shared';
import {
	deleteAutosaveSnapshot,
	downloadBlob,
	exportDeckJson,
	playFeedbackSound,
	rasterResultToPngBlob,
	shouldDiscardAutosaveOnSuccessfulSave,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { useExport } from './useExport';
import type { UseExportResult } from './useExport';
import { useExportProgress } from './useExportProgress';
import type { UseExportProgressResult } from './useExportProgress';
import { useExportRasterize } from './useExportRasterize';
import { useMediaExport } from './useMediaExport';
import type { UseMediaExportResult } from './useMediaExport';

export interface UseExportWiringInput {
	/** The merged (template-inclusive) slides; the off-screen stage renders one at a time. */
	mergedSlides: Ref<PptxSlide[]> | ComputedRef<PptxSlide[]>;
	slides: Ref<PptxSlide[]>;
	slideCount: ComputedRef<number>;
	canvasSize: Ref<CanvasSize>;
	activeSlideIndex: Ref<number>;
	saveAs: (format: PptxSaveFormat) => Promise<Uint8Array>;
	fileName?: () => string | undefined;
	/** Snapshot the live deck (slides + presentation-level state) for JSON export. */
	getDeckData: () => PptxData;
	/**
	 * File > Options > Advanced > "Image Size and Quality"
	 * (`resolveImageResolutionScale`), read fresh on every `rasterizeSlide()`
	 * call so a mid-session change applies without reconstructing this
	 * composable. A getter (not a `Ref`) so it can be wired in even though
	 * `viewerOptions` is not available yet at this composable's call site.
	 * The raw multiplier (default preset = 1), applied on top of the baseline
	 * 2x capture scale; see the `rasterizeSlide` body.
	 */
	imageExportScale?: () => number;
	/**
	 * Live File > Options getter, read only once a Save-As download actually
	 * completes (feedback sound, AutoRecover-snapshot discard). Omitted in
	 * tests that don't exercise those behaviors.
	 */
	getOptions?: () => ViewerOptions;
	/** IndexedDB key for this deck's AutoRecover snapshot, read at the same time. */
	filePath?: () => string | undefined;
}

export interface UseExportWiringResult {
	exportStageRef: Ref<HTMLElement | null>;
	exportSlide: ComputedRef<PptxSlide | undefined>;
	rasterizeSlide: (index: number, scaleMultiplier?: number) => Promise<HTMLCanvasElement>;
	rasterizeSlideToRaster: (
		index: number,
		scaleMultiplier?: number,
	) => Promise<RasterizeElementResult>;
	rasterizeSlideToTiles: (
		index: number,
		scaleMultiplier?: number,
	) => Promise<RasterizeElementTilesResult>;
	exporter: UseExportResult;
	mediaExport: UseMediaExportResult;
	exportProgressCtl: UseExportProgressResult;
	isExporting: ComputedRef<boolean>;
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportGif: () => void;
	onExportWebm: () => void;
	onExportJson: () => void;
	downloadAs: (format: PptxSaveFormat) => Promise<void>;
	onCopySlideAsImage: () => Promise<void>;
}

/**
 * useExportWiring: PNG/PDF/GIF/WebM export plus Save-As download and
 * copy-slide-as-image, all driven off one off-screen `rasterizeSlide` stage
 * (also reused by the Print dialog). Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function useExportWiring(input: UseExportWiringInput): UseExportWiringResult {
	const {
		mergedSlides,
		slides,
		slideCount,
		canvasSize,
		activeSlideIndex,
		saveAs,
		imageExportScale,
	} = input;

	// An off-screen stage renders one slide at a time at scale 1; `rasterizeSlide`
	// drives it and snapshots it with `html2canvas-pro`.
	const exportStageRef = ref<HTMLElement | null>(null);
	const exportIndex = ref(0);
	// Rasterise the merged slide (template layer included) so exports/print match
	// the on-screen presentation and the saved file.
	const exportSlide = computed(() => mergedSlides.value[exportIndex.value]);

	const { rasterizeSlide, rasterizeSlideToRaster, rasterizeSlideToTiles } = useExportRasterize({
		exportStageRef,
		exportIndex,
		canvasSize,
		imageExportScale,
	});

	const exporter = useExport({
		slides,
		canvasSize,
		rasterizeSlide,
		rasterizeSlideToRaster,
		rasterizeSlideToTiles,
	});
	const mediaExport = useMediaExport({ slideCount, rasterizeSlide });
	const exportProgressCtl = useExportProgress({ exporter, mediaExport });
	const isExporting = computed(() => exporter.exporting.value || mediaExport.exporting.value);
	function onExportPng(): void {
		void exporter.exportSlidePng(activeSlideIndex.value);
	}
	function onExportPdf(): void {
		void exportProgressCtl.runPdf();
	}
	function onExportGif(): void {
		void exportProgressCtl.runGif();
	}
	function onExportWebm(): void {
		void exportProgressCtl.runWebm();
	}

	/** Serialise the live deck to pptx-viewer-json and trigger a browser download. */
	function onExportJson(): void {
		try {
			exportDeckJson(input.getDeckData(), input.fileName?.() ?? null);
		} catch (err) {
			console.error('[PowerPointViewer] Export as JSON failed:', err);
		}
	}

	/** Serialise to a chosen OpenXML format and trigger a browser download. */
	async function downloadAs(format: PptxSaveFormat): Promise<void> {
		try {
			const bytes = await saveAs(format);
			// Legacy binary `.ppt` is an OLE2 compound file, not a ZIP: its own MIME
			// type, not the OOXML package one every other format shares.
			const mimeType =
				format === 'ppt'
					? 'application/vnd.ms-powerpoint'
					: 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
			const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
			downloadBlob(blob, `presentation.${format}`);
			// Options > Accessibility > "feedback with sound", and Options > Save >
			// "keep the last AutoRecover version": once a `.pptx` save lands, the
			// crash-recovery snapshot for this file is stale (the real file already
			// has the work), so it's discarded unless the user asked to keep it.
			const options = input.getOptions?.();
			if (options) {
				playFeedbackSound(options);
				const filePath = input.filePath?.();
				if (format === 'pptx' && filePath && shouldDiscardAutosaveOnSuccessfulSave(options)) {
					void deleteAutosaveSnapshot(filePath);
				}
			}
		} catch (err) {
			console.error(`[PowerPointViewer] Save as .${format} failed:`, err);
		}
	}

	/** Copy the active slide to the clipboard as a PNG image (File menu). */
	async function onCopySlideAsImage(): Promise<void> {
		try {
			const result = await rasterizeSlideToRaster(activeSlideIndex.value);
			const blob = await rasterResultToPngBlob(result);
			if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			}
		} catch (err) {
			console.error('[PowerPointViewer] Copy slide as image failed:', err);
		}
	}

	return {
		exportStageRef,
		exportSlide,
		rasterizeSlide,
		rasterizeSlideToRaster,
		rasterizeSlideToTiles,
		exporter,
		mediaExport,
		exportProgressCtl,
		isExporting,
		onExportPng,
		onExportPdf,
		onExportGif,
		onExportWebm,
		onExportJson,
		downloadAs,
		onCopySlideAsImage,
	};
}
