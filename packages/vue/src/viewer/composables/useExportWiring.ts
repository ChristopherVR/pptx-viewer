import type { PptxSaveFormat, PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { downloadBlob } from 'pptx-viewer-shared';
import { computed, nextTick, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { buildSharingPackage } from './package-sharing';
import { useExport } from './useExport';
import type { UseExportResult } from './useExport';
import { useExportProgress } from './useExportProgress';
import type { UseExportProgressResult } from './useExportProgress';
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
}

export interface UseExportWiringResult {
	exportStageRef: Ref<HTMLElement | null>;
	exportSlide: ComputedRef<PptxSlide | undefined>;
	rasterizeSlide: (index: number) => Promise<HTMLCanvasElement>;
	exporter: UseExportResult;
	mediaExport: UseMediaExportResult;
	exportProgressCtl: UseExportProgressResult;
	isExporting: ComputedRef<boolean>;
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportGif: () => void;
	onExportWebm: () => void;
	downloadAs: (format: PptxSaveFormat) => Promise<void>;
	packageForSharing: () => Promise<void>;
	onCopySlideAsImage: () => Promise<void>;
}

/**
 * useExportWiring: PNG/PDF/GIF/WebM export plus Save-As download and
 * copy-slide-as-image, all driven off one off-screen `rasterizeSlide` stage
 * (also reused by the Print dialog). Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function useExportWiring(input: UseExportWiringInput): UseExportWiringResult {
	const { mergedSlides, slides, slideCount, canvasSize, activeSlideIndex, saveAs } = input;

	// An off-screen stage renders one slide at a time at scale 1; `rasterizeSlide`
	// drives it and snapshots it with `html2canvas-pro`.
	const exportStageRef = ref<HTMLElement | null>(null);
	const exportIndex = ref(0);
	// Rasterise the merged slide (template layer included) so exports/print match
	// the on-screen presentation and the saved file.
	const exportSlide = computed(() => mergedSlides.value[exportIndex.value]);

	async function rasterizeSlide(index: number): Promise<HTMLCanvasElement> {
		exportIndex.value = index;
		await nextTick();
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
		const stageEl = exportStageRef.value?.querySelector('.pptx-vue-stage') as HTMLElement | null;
		if (!stageEl) {
			throw new Error('Export stage not ready');
		}
		const { default: html2canvas } = await import('html2canvas-pro');
		return html2canvas(stageEl, {
			backgroundColor: '#ffffff',
			scale: 2,
			width: canvasSize.value.width,
			height: canvasSize.value.height,
			logging: false,
		});
	}

	const exporter = useExport({ slides, canvasSize, rasterizeSlide });
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

	/** Serialise to a chosen OpenXML format and trigger a browser download. */
	async function downloadAs(format: PptxSaveFormat): Promise<void> {
		try {
			const bytes = await saveAs(format);
			const blob = new Blob([bytes as unknown as BlobPart], {
				type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			});
			downloadBlob(blob, `presentation.${format}`);
		} catch (err) {
			console.error(`[PowerPointViewer] Save as .${format} failed:`, err);
		}
	}

	/** Bundle the current deck with usage notes, matching React's File action. */
	async function packageForSharing(): Promise<void> {
		try {
			const fileName = input.fileName?.() || 'presentation.pptx';
			const bytes = await saveAs('pptx');
			const blob = await buildSharingPackage(bytes, fileName);
			const baseName = fileName.replace(/\.[^.]+$/u, '');
			downloadBlob(blob, `${baseName}-package.zip`);
		} catch (err) {
			console.error('[PowerPointViewer] Package export failed:', err);
		}
	}

	/** Copy the active slide to the clipboard as a PNG image (File menu). */
	async function onCopySlideAsImage(): Promise<void> {
		try {
			const canvas = await rasterizeSlide(activeSlideIndex.value);
			const blob = await new Promise<Blob | null>((resolve) => {
				canvas.toBlob((b) => resolve(b), 'image/png');
			});
			if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
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
		exporter,
		mediaExport,
		exportProgressCtl,
		isExporting,
		onExportPng,
		onExportPdf,
		onExportGif,
		onExportWebm,
		downloadAs,
		packageForSharing,
		onCopySlideAsImage,
	};
}
