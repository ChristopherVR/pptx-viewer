/**
 * PrintService: print orchestration for the Angular viewer.
 *
 * Pure layout/markup maths live in `./print-helpers` and are unit-tested in
 * isolation. This service holds the only DOM side effects: capturing each
 * slide to a PNG data URL, opening a print window, writing the document, and
 * invoking `window.print()`.
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

import { Injectable, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import {
	DEFAULT_PRINT_SETTINGS,
	buildHandoutsHtml,
	buildNotesHtml,
	buildOutlineHtml,
	buildPrintDocument,
	buildSlidesHtml,
	computeColorFilter,
	computeSlideIndices,
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
	 * The outline path needs no rasterisation. All other modes call
	 * `captureSlide` once per slide (sequentially) and skip slides that fail.
	 *
	 * @returns `true` if a print window was opened, `false` if blocked (popup
	 *          blocker) or there was nothing to print.
	 */
	async print(
		rawSettings: PrintSettings,
		slides: PptxSlide[],
		activeSlideIndex: number,
		captureSlide: CaptureSlideFn,
	): Promise<boolean> {
		this.closeDialog();

		const settings = validatePrintSettings(rawSettings, slides.length);
		const colorFilter = computeColorFilter(settings.colorMode);
		const slideIndices = computeSlideIndices(
			settings.slideRange,
			activeSlideIndex,
			slides.length,
			settings.customRangeFrom,
			settings.customRangeTo,
		);

		if (slideIndices.length === 0) {
			return false;
		}

		// ── Outline: no rasterisation needed ──────────────────────────────
		if (settings.printWhat === 'outline') {
			const body = `<div class="outline-page">${buildOutlineHtml(slideIndices, slides)}</div>`;
			return this._open(
				buildPrintDocument({
					title: 'Outline',
					bodyHtml: body,
					orientation: settings.orientation,
					colorFilter,
					frameSlides: settings.frameSlides,
				}),
			);
		}

		// ── Capture the requested slides to PNG data URLs ─────────────────
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
			return false;
		}

		if (settings.printWhat === 'slides') {
			return this._open(
				buildPrintDocument({
					title: 'Slides',
					bodyHtml: buildSlidesHtml(slideImages, capturedIndices),
					orientation: settings.orientation,
					colorFilter,
					frameSlides: settings.frameSlides,
				}),
			);
		}

		if (settings.printWhat === 'notes') {
			return this._open(
				buildPrintDocument({
					title: 'Notes Pages',
					bodyHtml: buildNotesHtml(slideImages, capturedIndices, slides),
					orientation: 'portrait',
					colorFilter,
					frameSlides: settings.frameSlides,
				}),
			);
		}

		// printWhat === 'handouts'
		return this._open(
			buildPrintDocument({
				title: `Handout ${settings.slidesPerPage} per page`,
				bodyHtml: buildHandoutsHtml(slideImages, capturedIndices, settings.slidesPerPage),
				orientation: 'portrait',
				colorFilter,
				frameSlides: settings.frameSlides,
			}),
		);
	}

	/* ---------------------------------------------------------------- */
	/*  Internal: print-window side effects (DOM only)                  */
	/* ---------------------------------------------------------------- */

	/**
	 * Open a print window, write the document, focus, and trigger printing.
	 * Returns `false` if the popup was blocked.
	 */
	private _open(htmlDocument: string): boolean {
		const printWindow = window.open('', '_blank', 'noopener,noreferrer');
		if (!printWindow) {
			return false;
		}
		printWindow.document.open();
		printWindow.document.write(htmlDocument);
		printWindow.document.close();
		printWindow.focus();
		setTimeout(() => {
			printWindow.print();
		}, 300);
		return true;
	}
}
