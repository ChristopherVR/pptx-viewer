import {
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	isExportAbortError,
	recordProgressPercent,
	slideProgressPercent,
	slideStatusLabel,
} from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

import type { ExportPdfOptions, UseExportResult } from './useExport';
import type { MediaExportOptions, UseMediaExportResult, WebmExportOptions } from './useMediaExport';

/**
 * useExportProgress: drives the `ExportProgressModal` while a multi-slide export
 * (PDF / GIF / WebM) runs. Vue counterpart of the React `useExportHandlers`
 * modal lifecycle.
 *
 * It owns the modal's reactive state (open / title / progress / status) plus the
 * `AbortController` the export loops check between slides, and wraps each export
 * in a `begin → run → end` envelope so the orchestrator only has to call
 * `onExportPdf()` / `onExportGif()` / `onExportWebm()` and render the modal.
 *
 * All percentage maths + status labels come from `pptx-viewer-shared`
 * (`export-progress.ts`) so React, Vue, and Angular show identical progress.
 */
export interface UseExportProgressOptions {
	/** PNG/PDF export composable (its `exportPdf` accepts progress + signal). */
	exporter: UseExportResult;
	/** GIF/WebM export composable (its exporters accept progress + signal). */
	mediaExport: UseMediaExportResult;
}

export interface UseExportProgressResult {
	/** Whether the progress modal is visible. */
	exportModalOpen: Ref<boolean>;
	/** Modal heading (e.g. "Export as PDF"). */
	exportModalTitle: Ref<string>;
	/** Current progress, 0-100. */
	exportProgress: Ref<number>;
	/** Status line under the bar (e.g. "Rendering slide 3 of 10..."). */
	exportStatusMessage: Ref<string>;
	/** Run the PDF export with the progress modal wired. */
	runPdf: () => Promise<void>;
	/** Run the GIF export with the progress modal wired. */
	runGif: () => Promise<void>;
	/** Run the WebM video export with the progress modal wired. */
	runWebm: () => Promise<void>;
	/** Cancel the in-flight export (aborts the loop, closes the modal). */
	cancelExport: () => void;
}

export function useExportProgress(options: UseExportProgressOptions): UseExportProgressResult {
	const { exporter, mediaExport } = options;

	const exportModalOpen = ref(false);
	const exportModalTitle = ref('');
	const exportProgress = ref(0);
	const exportStatusMessage = ref('');
	let abortController: AbortController | null = null;

	function beginExport(title: string): AbortController {
		const controller = new AbortController();
		abortController = controller;
		exportModalTitle.value = title;
		exportStatusMessage.value = 'Capturing slides...';
		exportProgress.value = 0;
		exportModalOpen.value = true;
		return controller;
	}

	function endExport(): void {
		abortController = null;
		exportModalOpen.value = false;
	}

	async function runPdf(): Promise<void> {
		const controller = beginExport('Export as PDF');
		const pdfOptions: ExportPdfOptions = {
			signal: controller.signal,
			onProgress: (current, total) => {
				exportProgress.value = slideProgressPercent(current, total);
				exportStatusMessage.value = slideStatusLabel('Rendering', current, total);
			},
		};
		try {
			await exporter.exportPdf(pdfOptions);
			exportProgress.value = EXPORT_ASSEMBLING_PERCENT;
			exportStatusMessage.value = 'Building PDF...';
			exportProgress.value = EXPORT_DONE_PERCENT;
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] PDF export failed:', err);
			}
		} finally {
			endExport();
		}
	}

	async function runGif(): Promise<void> {
		const controller = beginExport('Export as GIF');
		const gifOptions: MediaExportOptions = {
			signal: controller.signal,
			onProgress: (current, total) => {
				exportProgress.value = slideProgressPercent(current, total);
				exportStatusMessage.value = slideStatusLabel('Encoding', current, total);
			},
		};
		try {
			await mediaExport.exportGif(gifOptions);
			exportStatusMessage.value = 'Saving file...';
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] GIF export failed:', err);
			}
		} finally {
			endExport();
		}
	}

	async function runWebm(): Promise<void> {
		const controller = beginExport('Export as Video');
		const webmOptions: WebmExportOptions = {
			signal: controller.signal,
			onProgress: (current, total) => {
				exportProgress.value = slideProgressPercent(current, total, 45);
				exportStatusMessage.value = slideStatusLabel('Capturing', current, total);
			},
			onRecordProgress: (current, total) => {
				exportProgress.value = recordProgressPercent(current, total);
				exportStatusMessage.value = slideStatusLabel('Recording', current, total);
			},
		};
		try {
			await mediaExport.exportWebm(webmOptions);
			exportStatusMessage.value = 'Saving file...';
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] Video export failed:', err);
			}
		} finally {
			endExport();
		}
	}

	function cancelExport(): void {
		abortController?.abort();
		abortController = null;
		exportModalOpen.value = false;
		exportProgress.value = 0;
	}

	return {
		exportModalOpen,
		exportModalTitle,
		exportProgress,
		exportStatusMessage,
		runPdf,
		runGif,
		runWebm,
		cancelExport,
	};
}
