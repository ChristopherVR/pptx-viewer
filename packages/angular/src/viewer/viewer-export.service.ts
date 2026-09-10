/**
 * viewer-export.service.ts: Viewer-scoped orchestration for the "render every
 * slide to the live stage and capture it" family of actions: single-slide PNG,
 * multi-page PDF, animated GIF, WebM video, and the print job. Owns the
 * export-progress modal state and the cooperative-cancel `AbortController`.
 *
 * Extracted from {@link PowerPointViewerComponent} to keep that orchestrator
 * thin: the component binds the service via {@link bind} once (handing over the
 * live `activeSlideIndex` signal, the slide count / merged-deck accessors, and a
 * resolver for the live `.pptx-ng-canvas-stage` element) and the template reads
 * the modal signals / invokes the export methods directly off the injected
 * instance.
 *
 * Provide it once on the viewer component (`providers: [ViewerExportService]`).
 */

import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import {
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	isExportAbortError,
	recordProgressPercent,
	slideStatusLabel,
} from '../internal/shared';
import { slideFileName } from './export-helpers';
import { ExportService } from './export.service';
import { LoadContentService } from './load-content.service';
import type { PrintSettings } from './print-helpers';
import { PrintService } from './print.service';
import {
	captureSlideCanvases,
	captureSlideDataUrl,
	captureSlideTiles,
} from './viewer-export-capture';
import type { ExportHost } from './viewer-export-capture';

export type { ExportHost } from './viewer-export-capture';

@Injectable()
export class ViewerExportService {
	private readonly exportSvc = inject(ExportService);
	private readonly loader = inject(LoadContentService);
	private readonly print = inject(PrintService);
	private readonly translate = inject(TranslateService);

	/** True while a PNG/PDF export is in progress (disables the buttons). */
	readonly exporting = signal(false);
	/** Export-progress modal state (PDF / GIF / WebM). */
	readonly modalOpen = signal(false);
	readonly modalTitle = signal('');
	readonly progress = signal(0);
	readonly statusMessage = signal('');
	/** Cooperative cancellation: the capture loop checks `signal.aborted`. */
	private abort: AbortController | null = null;

	private host: ExportHost | null = null;

	/** Wire the live host accessors (called once from the component constructor). */
	bind(host: ExportHost): void {
		this.host = host;
	}

	private requireHost(): ExportHost {
		if (!this.host) {
			throw new Error('ViewerExportService.bind() was not called');
		}
		return this.host;
	}

	/** Export the current slide as a PNG download. */
	async exportPng(): Promise<void> {
		const host = this.requireHost();
		const el = host.resolveStage();
		if (!el || this.exporting()) {
			return;
		}
		this.exporting.set(true);
		try {
			await this.exportSvc.exportElementToPng(
				el,
				slideFileName('slide', host.activeSlideIndex() + 1, 'png'),
				host.imageExportScale?.() ?? 2,
			);
		} finally {
			this.exporting.set(false);
		}
	}

	/** Copy the current slide to the system clipboard as a PNG image. */
	async copySlideAsImage(): Promise<void> {
		const host = this.requireHost();
		const el = host.resolveStage();
		if (!el || this.exporting()) {
			return;
		}
		this.exporting.set(true);
		try {
			await this.exportSvc.copyElementAsPng(el, host.imageExportScale?.() ?? 2);
		} catch (err) {
			console.error('[PowerPointViewer] Copy slide as image failed:', err);
		} finally {
			this.exporting.set(false);
		}
	}

	/**
	 * Export every slide to a multi-page PDF. Each slide is made the live stage,
	 * given a render tick to settle, captured to a canvas, then the original
	 * slide is restored. Progress + Cancel drive the export-progress modal.
	 */
	async exportPdf(): Promise<void> {
		const host = this.requireHost();
		if (host.slideCount() === 0 || this.exporting()) {
			return;
		}
		const controller = this.beginExport(this.translate.instant('pptx.mobileMenu.exportPdf'));
		const { width, height } = this.loader.canvasSize();
		try {
			const pages = await captureSlideTiles(
				this.exportSvc,
				host,
				this.progressSinks,
				controller.signal,
				this.translate.instant('pptx.export.rendering'),
				90,
				host.imageExportScale?.() ?? 2,
			);
			this.progress.set(EXPORT_ASSEMBLING_PERCENT);
			this.statusMessage.set(this.translate.instant('pptx.export.buildingPdf'));
			this.exportSvc.exportTiledPagesToPdf(pages, width, height, 'presentation.pdf');
			this.progress.set(EXPORT_DONE_PERCENT);
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] PDF export failed:', err);
			}
		} finally {
			this.endExport();
		}
	}

	/** Export every slide as an animated GIF (2s per slide). */
	async exportGif(): Promise<void> {
		const host = this.requireHost();
		if (host.slideCount() === 0 || this.exporting()) {
			return;
		}
		const controller = this.beginExport(this.translate.instant('pptx.mobileMenu.exportGif'));
		try {
			const canvases = await captureSlideCanvases(
				this.exportSvc,
				host,
				this.progressSinks,
				controller.signal,
				this.translate.instant('pptx.export.encoding'),
				90,
			);
			this.progress.set(EXPORT_ASSEMBLING_PERCENT);
			this.statusMessage.set(this.translate.instant('pptx.export.savingFile'));
			this.exportSvc.exportCanvasesToGif(canvases, 2000, 'presentation.gif');
			this.progress.set(EXPORT_DONE_PERCENT);
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] GIF export failed:', err);
			}
		} finally {
			this.endExport();
		}
	}

	/** Export every slide as a WebM video (3s per slide) via MediaRecorder. */
	async exportVideo(): Promise<void> {
		const host = this.requireHost();
		if (host.slideCount() === 0 || this.exporting()) {
			return;
		}
		const controller = this.beginExport(this.translate.instant('pptx.mobileMenu.exportVideo'));
		try {
			const canvases = await captureSlideCanvases(
				this.exportSvc,
				host,
				this.progressSinks,
				controller.signal,
				this.translate.instant('pptx.export.capturing'),
				45,
			);
			this.progress.set(EXPORT_ASSEMBLING_PERCENT);
			this.statusMessage.set(this.translate.instant('pptx.export.recordingVideo'));
			await this.exportSvc.exportCanvasesToWebm(
				canvases,
				3000,
				'presentation.webm',
				controller.signal,
				(current, total) => {
					this.progress.set(recordProgressPercent(current, total));
					this.statusMessage.set(
						slideStatusLabel(this.translate.instant('pptx.export.recording'), current, total),
					);
				},
			);
			this.progress.set(EXPORT_DONE_PERCENT);
		} catch (err) {
			if (!isExportAbortError(err)) {
				console.error('[PowerPointViewer] Video export failed:', err);
			}
		} finally {
			this.endExport();
		}
	}

	/**
	 * `includeHiddenSlides`: Options > Advanced > "Print hidden slides".
	 * `highQuality`: Options > Advanced > "High quality" raster scale for the
	 * notes/handouts fallback path, composed on top of the host's own Image
	 * Size/Quality scale.
	 */
	async onPrint(
		settings: PrintSettings,
		includeHiddenSlides = false,
		highQuality = false,
	): Promise<void> {
		const host = this.requireHost();
		const original = host.activeSlideIndex();
		const printScale = (host.imageExportScale?.() ?? 2) * (highQuality ? 2 : 1);
		try {
			await this.print.print(
				settings,
				[...host.mergedSlides()],
				original,
				(index) => captureSlideDataUrl(this.exportSvc, host, index, printScale),
				this.loader.canvasSize(),
				includeHiddenSlides,
				this.loader.handoutMaster(),
			);
		} finally {
			host.activeSlideIndex.set(original);
		}
	}

	onCancelExport(): void {
		this.abort?.abort();
		this.abort = null;
		this.modalOpen.set(false);
		this.progress.set(0);
	}

	/**
	 * Open the progress modal and arm a fresh `AbortController` for an export.
	 * Returns the controller whose `signal` the capture loop checks per slide.
	 */
	private beginExport(title: string): AbortController {
		const controller = new AbortController();
		this.abort = controller;
		this.modalTitle.set(title);
		this.statusMessage.set(this.translate.instant('pptx.export.capturingSlides'));
		this.progress.set(0);
		this.modalOpen.set(true);
		this.exporting.set(true);
		return controller;
	}

	private endExport(): void {
		this.abort = null;
		this.modalOpen.set(false);
		this.exporting.set(false);
	}

	/**
	 * Progress-reporting sink handed to the extracted capture-loop functions
	 * in `viewer-export-capture.ts`, called directly at each export call site
	 * (`captureSlideCanvases`/`captureSlideTiles`/`captureSlideDataUrl`) rather
	 * than via a same-named private wrapper per method.
	 */
	private readonly progressSinks = {
		setProgress: (value: number) => this.progress.set(value),
		setStatusMessage: (value: string) => this.statusMessage.set(value),
	};
}
