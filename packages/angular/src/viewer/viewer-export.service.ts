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
import type { WritableSignal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import {
	EXPORT_ASSEMBLING_PERCENT,
	EXPORT_DONE_PERCENT,
	isExportAbortError,
	recordProgressPercent,
	slideProgressPercent,
	slideStatusLabel,
} from '../internal/shared';
import { slideFileName } from './export-helpers';
import { ExportService } from './export.service';
import { LoadContentService } from './load-content.service';
import type { PrintSettings } from './print-helpers';
import { PrintService } from './print.service';

/** Live accessors the export loop needs from the host component. */
interface ExportHost {
	/** The component's active-slide index (read + written to flip the live stage). */
	readonly activeSlideIndex: WritableSignal<number>;
	/** Current slide count of the displayed deck. */
	readonly slideCount: () => number;
	/** The full deck (templates merged back) for the print job. */
	readonly mergedSlides: () => readonly PptxSlide[];
	/** Resolve the live slide-stage element, or `undefined` when not mounted. */
	readonly resolveStage: () => HTMLElement | undefined;
}

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
			);
		} finally {
			this.exporting.set(false);
		}
	}

	/** Copy the current slide to the system clipboard as a PNG image. */
	async copySlideAsImage(): Promise<void> {
		const el = this.requireHost().resolveStage();
		if (!el || this.exporting()) {
			return;
		}
		this.exporting.set(true);
		try {
			await this.exportSvc.copyElementAsPng(el);
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
			const canvases = await this.captureSlideCanvases(
				controller.signal,
				this.translate.instant('pptx.export.rendering'),
				90,
			);
			this.progress.set(EXPORT_ASSEMBLING_PERCENT);
			this.statusMessage.set(this.translate.instant('pptx.export.buildingPdf'));
			this.exportSvc.exportCanvasesToPdf(canvases, width, height, 'presentation.pdf');
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
			const canvases = await this.captureSlideCanvases(
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
			const canvases = await this.captureSlideCanvases(
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

	async onPrint(settings: PrintSettings): Promise<void> {
		const host = this.requireHost();
		const original = host.activeSlideIndex();
		try {
			await this.print.print(
				settings,
				[...host.mergedSlides()],
				original,
				(index) => this.captureSlideDataUrl(index),
				this.loader.canvasSize(),
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
	 * Render every slide to a canvas (each made the live stage in turn), reporting
	 * per-slide progress and bailing out cooperatively when `abortSignal.aborted`.
	 */
	private async captureSlideCanvases(
		abortSignal: AbortSignal,
		verb: string,
		span: number,
	): Promise<HTMLCanvasElement[]> {
		const host = this.requireHost();
		const total = host.slideCount();
		const original = host.activeSlideIndex();
		const canvases: HTMLCanvasElement[] = [];
		try {
			for (let i = 0; i < total; i++) {
				if (abortSignal.aborted) {
					throw new DOMException('Export cancelled', 'AbortError');
				}
				this.progress.set(slideProgressPercent(i, total, span));
				this.statusMessage.set(slideStatusLabel(verb, i, total));
				host.activeSlideIndex.set(i);
				await new Promise<void>((resolve) => {
					setTimeout(resolve, 150);
				});
				const el = host.resolveStage();
				if (el) {
					canvases.push(await this.exportSvc.renderElement(el));
				}
			}
		} finally {
			host.activeSlideIndex.set(original);
		}
		return canvases;
	}

	/** Flip the live stage to `index`, let it settle, and capture it to a PNG data URL. */
	private async captureSlideDataUrl(index: number): Promise<string | null> {
		const host = this.requireHost();
		host.activeSlideIndex.set(index);
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 150);
		});
		const el = host.resolveStage();
		if (!el) {
			return null;
		}
		const canvas = await this.exportSvc.renderElement(el);
		return canvas.toDataURL('image/png');
	}
}
