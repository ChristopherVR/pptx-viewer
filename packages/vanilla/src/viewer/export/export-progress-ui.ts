import {
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	isExportAbortError,
	recordProgressPercent,
	slideProgressPercent,
	slideStatusLabel,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { ExportController, ExportPdfOptions } from './export-controller';
import type { ExportGifOptions } from './export-gif';
import type { ExportProgressModal } from './export-progress-modal';
import type { ExportVideoOptions } from './export-video';

/**
 * Wires the multi-slide exports (PDF / GIF / WebM) to the progress modal:
 * a `begin -> run -> end` envelope owning the modal state and the
 * `AbortController` the export loops check between slides. Vanilla port of
 * Svelte's `ExportUiState` / Vue's `useExportProgress`; all percentage maths
 * and status labels come from `pptx-viewer-shared` (`export-progress.ts`) so
 * every binding shows identical progress.
 *
 * A caller-supplied `onProgress`/`signal` (the public `PptxViewerInstance`
 * export API accepts them) still works: caller callbacks are invoked alongside
 * the modal's, and an aborted caller signal aborts the envelope's controller.
 */
export interface ExportProgressUiDeps {
	modal: ExportProgressModal;
	controller: ExportController;
	getTranslator(): Translator;
}

export interface ExportProgressUi {
	runPdf(options?: ExportPdfOptions): Promise<void>;
	runGif(options?: ExportGifOptions): Promise<void>;
	runVideo(options?: ExportVideoOptions): Promise<void>;
	/** Abort the in-flight export (the modal's Cancel control routes here). */
	cancel(): void;
}

export function createExportProgressUi(deps: ExportProgressUiDeps): ExportProgressUi {
	let abort: AbortController | null = null;
	const t = (key: string): string => deps.getTranslator()(key);

	const begin = (title: string, callerSignal: AbortSignal | undefined): AbortController => {
		const controller = new AbortController();
		abort = controller;
		if (callerSignal) {
			// Chain a caller-owned signal into the envelope's controller so the
			// loop only ever has to watch one signal.
			if (callerSignal.aborted) {
				controller.abort();
			} else {
				callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
			}
		}
		deps.modal.open(title, t('pptx.export.capturingSlides'));
		return controller;
	};

	const end = (): void => {
		abort = null;
		deps.modal.close();
	};

	const fail = (what: string, err: unknown): void => {
		if (!isExportAbortError(err)) {
			console.error(`[pptx-vanilla-viewer] ${what} export failed:`, err);
		}
	};

	return {
		async runPdf(options = {}) {
			const envelope = begin(t('pptx.ribbon.exportPdf'), options.signal);
			try {
				await deps.controller.exportPdf({
					...options,
					signal: envelope.signal,
					onProgress: (current, total) => {
						options.onProgress?.(current, total);
						deps.modal.update(
							slideProgressPercent(current, total),
							slideStatusLabel(t('pptx.export.rendering'), current, total),
						);
					},
				});
				deps.modal.update(EXPORT_ASSEMBLING_PERCENT, t('pptx.export.buildingPdf'));
				deps.modal.update(EXPORT_DONE_PERCENT, t('pptx.export.buildingPdf'));
			} catch (err) {
				fail('PDF', err);
			} finally {
				end();
			}
		},
		async runGif(options = {}) {
			const envelope = begin(t('pptx.ribbon.exportGif'), options.signal);
			try {
				await deps.controller.exportGif({
					...options,
					signal: envelope.signal,
					onProgress: (current, total) => {
						options.onProgress?.(current, total);
						deps.modal.update(
							slideProgressPercent(current, total),
							slideStatusLabel(t('pptx.export.encoding'), current, total),
						);
					},
				});
				deps.modal.update(EXPORT_DONE_PERCENT, t('pptx.export.savingFile'));
			} catch (err) {
				fail('GIF', err);
			} finally {
				end();
			}
		},
		async runVideo(options = {}) {
			const envelope = begin(t('pptx.ribbon.exportVideo'), options.signal);
			try {
				await deps.controller.exportVideo({
					...options,
					signal: envelope.signal,
					onProgress: (current, total) => {
						options.onProgress?.(current, total);
						deps.modal.update(
							slideProgressPercent(current, total, 45),
							slideStatusLabel(t('pptx.export.capturing'), current, total),
						);
					},
					onRecordProgress: (current, total) => {
						options.onRecordProgress?.(current, total);
						deps.modal.update(
							recordProgressPercent(current, total),
							slideStatusLabel(t('pptx.export.recording'), current, total),
						);
					},
				});
				deps.modal.update(EXPORT_DONE_PERCENT, t('pptx.export.savingFile'));
			} catch (err) {
				fail('Video', err);
			} finally {
				end();
			}
		},
		cancel() {
			abort?.abort();
			abort = null;
			deps.modal.close();
		},
	};
}
