import {
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	isExportAbortError,
	recordProgressPercent,
	slideProgressPercent,
	slideStatusLabel,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n/translator';
import type { ExportController } from './export-controller.svelte';

/**
 * ExportUiState: reactive state behind the toolbar `ExportMenu` and the
 * `ExportProgressModal`. Svelte port of Vue's `useExportProgress` composable:
 * it owns the modal state (open / title / progress / status), the
 * `AbortController` the export loops check between slides, and wraps each
 * multi-slide export (PDF / GIF / WebM) in a `begin -> run -> end` envelope.
 * All percentage maths + status labels come from `pptx-viewer-shared`
 * (`export-progress.ts`) so every binding shows identical progress.
 *
 * PNG (single slide, fast) and print (opens its own surface) run without the
 * modal; the menu trigger still disables via {@link exporting} while they run.
 */
export interface ExportUiDeps {
	controller: ExportController;
	getTranslator(): Translator;
}

export class ExportUiState {
	/** Whether the progress modal is visible. */
	open = $state(false);
	/** Modal heading (e.g. "Export as PDF"). */
	title = $state('');
	/** Current progress, 0-100. */
	progress = $state(0);
	/** Status line under the bar (e.g. "Rendering slide 3 of 10..."). */
	status = $state('');

	#abort: AbortController | null = null;
	readonly #deps: ExportUiDeps;

	constructor(deps: ExportUiDeps) {
		this.#deps = deps;
	}

	/** True while any export runs (disables the menu trigger). */
	get exporting(): boolean {
		return this.#deps.controller.exporting;
	}

	#t(key: string): string {
		return this.#deps.getTranslator()(key);
	}

	#begin(title: string): AbortController {
		const abort = new AbortController();
		this.#abort = abort;
		this.title = title;
		this.status = this.#t('pptx.export.capturingSlides');
		this.progress = 0;
		this.open = true;
		return abort;
	}

	#end(): void {
		this.#abort = null;
		this.open = false;
		this.progress = 0;
	}

	#fail(what: string, err: unknown): void {
		if (!isExportAbortError(err)) {
			console.error(`[PowerPointViewer] ${what} export failed:`, err);
		}
	}

	/** Export the current slide as PNG (no modal; quick single capture). */
	runPng(): void {
		this.#deps.controller.exportSlidePng().catch((err: unknown) => this.#fail('PNG', err));
	}

	/** Copy the current slide to the system image clipboard. */
	runCopyImage(): void {
		this.#deps.controller.copySlideAsImage().catch((err: unknown) => this.#fail('Copy image', err));
	}

	/** Run the PDF export with the progress modal wired. */
	async runPdf(): Promise<void> {
		const abort = this.#begin(this.#t('pptx.ribbon.exportPdf'));
		try {
			await this.#deps.controller.exportPdf({
				signal: abort.signal,
				onProgress: (current, total) => {
					this.progress = slideProgressPercent(current, total);
					this.status = slideStatusLabel(this.#t('pptx.export.rendering'), current, total);
				},
			});
			this.progress = EXPORT_ASSEMBLING_PERCENT;
			this.status = this.#t('pptx.export.buildingPdf');
			this.progress = EXPORT_DONE_PERCENT;
		} catch (err) {
			this.#fail('PDF', err);
		} finally {
			this.#end();
		}
	}

	/** Run the animated-GIF export with the progress modal wired. */
	async runGif(): Promise<void> {
		const abort = this.#begin(this.#t('pptx.ribbon.exportGif'));
		try {
			await this.#deps.controller.exportGif({
				signal: abort.signal,
				onProgress: (current, total) => {
					this.progress = slideProgressPercent(current, total);
					this.status = slideStatusLabel(this.#t('pptx.export.encoding'), current, total);
				},
			});
			this.status = this.#t('pptx.export.savingFile');
		} catch (err) {
			this.#fail('GIF', err);
		} finally {
			this.#end();
		}
	}

	/** Run the WebM video export with the progress modal wired. */
	async runVideo(): Promise<void> {
		const abort = this.#begin(this.#t('pptx.ribbon.exportVideo'));
		try {
			await this.#deps.controller.exportVideo({
				signal: abort.signal,
				onProgress: (current, total) => {
					this.progress = slideProgressPercent(current, total, 45);
					this.status = slideStatusLabel(this.#t('pptx.export.capturing'), current, total);
				},
				onRecordProgress: (current, total) => {
					this.progress = recordProgressPercent(current, total);
					this.status = slideStatusLabel(this.#t('pptx.export.recording'), current, total);
				},
			});
			this.status = this.#t('pptx.export.savingFile');
		} catch (err) {
			this.#fail('Video', err);
		} finally {
			this.#end();
		}
	}

	/** Run the print flow (no modal; the print surface takes over). */
	runPrint(): void {
		this.#deps.controller.print().catch((err: unknown) => this.#fail('Print', err));
	}

	/** Cancel the in-flight export (aborts the loop, closes the modal). */
	cancel(): void {
		this.#abort?.abort();
		this.#abort = null;
		this.open = false;
		this.progress = 0;
	}
}
