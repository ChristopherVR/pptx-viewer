/**
 * PrintService: print orchestration for the Angular viewer.
 *
 * Pure layout/markup maths live in `./print-helpers`. Direct slide printing
 * uses core SVG output; notes and handouts retain the DOM raster path.
 *
 * Slide capture is decoupled from rendering: the host viewer passes a
 * `captureSlide(index)` callback that flips the live stage to `index` and
 * rasterises it (typically via {@link ExportService.renderElement} +
 * `canvas.toDataURL`). The viewer owns the one reused stage node, so capture
 * must be sequential, exactly as the React raster path does.
 *
 * Dialog open/close state and the active settings are exposed as signals so
 * the toolbar and dialog component can bind to them directly.
 *
 * Provide at the component level so its lifetime tracks the host viewer:
 * `@Component({ providers: [PrintService] })`.
 */

import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import {
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_CANVAS_WIDTH,
	buildPrintDocument as buildSvgPrintDocument,
	finishPrintWindow,
	openPendingPrintWindow,
	openPrintWindow,
} from '../internal/shared';
import { addSvgSlideFrame, exportSlideToSvg } from './export-svg';
import {
	DEFAULT_PRINT_SETTINGS,
	buildHandoutsHtml,
	buildNotesHtml,
	buildOutlineHtml,
	buildPrintDocument,
	computeColorFilter,
	computeSlideIndices,
	filterHiddenSlideIndices,
	validatePrintSettings,
} from './print-helpers';
import type { PrintSettings } from './print-helpers';

/**
 * Captures the slide at `index` (zero-based) to a PNG `data:` URL. The viewer
 * supplies this: it flips the live stage to `index` and rasterises it.
 * Returning `null`/empty for a slide skips it.
 */
export type CaptureSlideFn = (index: number) => Promise<string | null>;

@Injectable()
export class PrintService {
	private readonly translate = inject(TranslateService);

	/** Whether the print dialog is currently open. */
	readonly isDialogOpen = signal(false);

	/** The current (validated) print settings. */
	readonly settings = signal<PrintSettings>({ ...DEFAULT_PRINT_SETTINGS });

	/** Open the print dialog. */
	openDialog(): void {
		this.isDialogOpen.set(true);
	}

	/** Close the print dialog. */
	closeDialog(): void {
		this.isDialogOpen.set(false);
	}

	/**
	 * Validate + store settings against the slide count. Returns the resolved
	 * settings so callers can use them immediately.
	 */
	updateSettings(partial: Partial<PrintSettings>, slideCount: number): PrintSettings {
		const resolved = validatePrintSettings({ ...this.settings(), ...partial }, slideCount);
		this.settings.set(resolved);
		return resolved;
	}

	/**
	 * Run the full print flow for the given settings:
	 *   1. Resolve the slide index list.
	 *   2. Build the printable HTML (capturing slides as needed).
	 *   3. Open a print window and trigger `window.print()`.
	 *
	 * Outline and full-page slides need no rasterisation. Notes and handouts
	 * call `captureSlide` sequentially and skip slides that fail.
	 *
	 * @returns `true` if a print window was opened, `false` if blocked (popup
	 *          blocker) or there was nothing to print.
	 */
	async print(
		rawSettings: PrintSettings,
		slides: PptxSlide[],
		activeSlideIndex: number,
		captureSlide: CaptureSlideFn,
		slideSize: Readonly<{ width: number; height: number }> = {
			width: DEFAULT_CANVAS_WIDTH,
			height: DEFAULT_CANVAS_HEIGHT,
		},
		/** Options > Advanced > "Print hidden slides". Defaults to PowerPoint's own default (excluded). */
		includeHiddenSlides = false,
	): Promise<boolean> {
		this.closeDialog();

		const settings = validatePrintSettings(rawSettings, slides.length);
		const colorFilter = computeColorFilter(settings.colorMode);
		const slideIndices = filterHiddenSlideIndices(
			computeSlideIndices(
				settings.slideRange,
				activeSlideIndex,
				slides.length,
				settings.customRangeFrom,
				settings.customRangeTo,
			),
			slides,
			includeHiddenSlides,
		);

		if (slideIndices.length === 0) {
			return false;
		}

		// ── Outline: no rasterisation needed ──────────────────────────────
		if (settings.printWhat === 'outline') {
			const body = `<div class="outline-page">${buildOutlineHtml(slideIndices, slides)}</div>`;
			return this._open(
				buildPrintDocument({
					title: this.translate.instant('pptx.print.outline'),
					bodyHtml: body,
					orientation: settings.orientation,
					colorFilter,
					frameSlides: settings.frameSlides,
					scaleToFit: settings.scaleToFit,
				}),
			);
		}

		if (settings.printWhat === 'slides') {
			const svgs = slideIndices.flatMap((index) => {
				const slide = slides[index];
				if (!slide) {
					return [];
				}
				const svg = exportSlideToSvg(slide, slideSize.width, slideSize.height);
				return [
					settings.frameSlides ? addSvgSlideFrame(svg, slideSize.width, slideSize.height) : svg,
				];
			});
			if (svgs.length === 0) {
				return false;
			}
			return this._open(
				buildSvgPrintDocument(svgs, slideSize.width, slideSize.height, {
					title: this.translate.instant('pptx.sections.slides'),
					orientation: settings.orientation,
					colorFilter,
					scaleToFit: settings.scaleToFit,
				}),
			);
		}

		// ── Capture the requested slides to PNG data URLs ─────────────────
		// `captureSlide` awaits per slide, so the print window has to be opened
		// NOW, before that first await, or the browser silently blocks it as a
		// popup the instant the call stack leaves the click's user gesture (see
		// `openPendingPrintWindow`, shared by every window.open-based binding).
		const pendingWindow = openPendingPrintWindow(
			this.translate.instant('pptx.print.preparingToPrint'),
		);
		if (!pendingWindow) {
			return false;
		}

		const slideImages: string[] = [];
		const capturedIndices: number[] = [];
		for (const idx of slideIndices) {
			const dataUrl = await captureSlide(idx);
			if (dataUrl) {
				slideImages.push(dataUrl);
				capturedIndices.push(idx);
			}
		}

		if (slideImages.length === 0) {
			pendingWindow.close();
			return false;
		}

		if (settings.printWhat === 'notes') {
			finishPrintWindow(
				pendingWindow,
				buildPrintDocument({
					title: this.translate.instant('pptx.print.notesPages'),
					bodyHtml: buildNotesHtml(slideImages, capturedIndices, slides),
					orientation: 'portrait',
					colorFilter,
					frameSlides: settings.frameSlides,
					scaleToFit: settings.scaleToFit,
				}),
			);
			return true;
		}

		// printWhat === 'handouts'
		finishPrintWindow(
			pendingWindow,
			buildPrintDocument({
				title: this.translate.instant('pptx.print.handoutPerPageTitle', {
					count: settings.slidesPerPage,
				}),
				bodyHtml: buildHandoutsHtml(slideImages, capturedIndices, settings.slidesPerPage),
				orientation: 'portrait',
				colorFilter,
				frameSlides: settings.frameSlides,
				scaleToFit: settings.scaleToFit,
			}),
		);
		return true;
	}

	/* ---------------------------------------------------------------- */
	/*  Internal: print-window side effects (DOM only)                  */
	/* ---------------------------------------------------------------- */

	/**
	 * Open a print window, write the document, focus, and trigger printing, all
	 * in one synchronous call. Used by the outline/slides paths, which never
	 * `await` before this point so the window is never at risk of being popup
	 * blocked -- no need for the placeholder-then-real-document split `print`'s
	 * notes/handouts branch needs (see `openPendingPrintWindow`/`finishPrintWindow`).
	 */
	private _open(htmlDocument: string): boolean {
		return openPrintWindow(htmlDocument);
	}
}
