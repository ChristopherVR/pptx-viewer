import type { PptxSlide } from 'pptx-viewer-core';
import {
	buildHandoutsHtml,
	buildNotesHtml,
	buildPrintDocument as buildSvgPrintDocument,
	buildPrintHtmlDocument,
	buildSlidesHtml,
} from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

import {
	buildOutlineHtml,
	computeColorFilter,
	computeSlideIndices,
} from '../components/print-dialog-types';
import type { PrintSettings } from '../components/print-dialog-types';
import { exportSlideToSvg } from '../export-svg';
import type { CanvasSize } from '../types';

/**
 * usePrint: print-dialog state + the print-with-settings flow for the Vue
 * viewer. Direct slide printing uses core SVG output; composed notes and
 * handouts retain the DOM raster path.
 *
 * The DOM-touching pieces are injected so the composable is unit-testable with
 * mocks, exactly like `useExport` injects `rasterizeSlide`:
 *  - `rasterizeSlide(index)` rasterises one slide to a canvas (the host owns the
 *    off-screen `SlideStage` + `html2canvas-pro` integration).
 *  - `openPrintWindow(html)` opens a print window for a full HTML document. A
 *    default implementation (`window.open` → write → print) is supplied.
 *
 * Slide titles for outline mode reuse the shared `buildOutlineHtml`.
 */

/** Rasterise the slide at `index` to a canvas. Host-supplied (DOM-coupled). */
export type RasterizeSlide = (index: number) => Promise<HTMLCanvasElement>;

/**
 * Open a print window for a complete HTML document and trigger printing.
 * Returns `false` if the window was blocked (e.g. popup blocker).
 */
export type OpenPrintWindow = (htmlDocument: string) => boolean;

export interface UsePrintOptions {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	rasterizeSlide: RasterizeSlide;
	/** Native presentation dimensions used for vector slide printing. */
	slideSize?: Ref<CanvasSize>;
	/** Override the print-window opener (defaults to a `window.open` impl). */
	openPrintWindow?: OpenPrintWindow;
}

export interface UsePrintResult {
	/** Whether the print dialog is open. */
	isPrintDialogOpen: Ref<boolean>;
	/** Open the print dialog (the toolbar print button). */
	openPrintDialog: () => void;
	/** Close the print dialog without printing. */
	closePrintDialog: () => void;
	/** Run the print flow for the confirmed settings (closes the dialog first). */
	print: (settings: PrintSettings) => Promise<void>;
}

/** Default print-window opener: writes a full HTML doc and calls `print()`. */
function defaultOpenPrintWindow(htmlDocument: string): boolean {
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

/**
 * Assemble the print stylesheet + body into a complete HTML document. Thin
 * wrapper over the shared `buildPrintHtmlDocument` (title/orientation/colour-
 * filter escaping and body sanitisation live there once, reused by every
 * binding) that keeps this composable's historical positional signature.
 */
function buildPrintDocument(
	title: string,
	bodyHtml: string,
	orientation: 'landscape' | 'portrait',
	colorFilter: string,
	frameSlides: boolean,
): string {
	return buildPrintHtmlDocument({ title, bodyHtml, orientation, colorFilter, frameSlides });
}

export function usePrint(options: UsePrintOptions): UsePrintResult {
	const { slides, activeSlideIndex, rasterizeSlide } = options;
	const openWindow = options.openPrintWindow ?? defaultOpenPrintWindow;
	const slideSize = options.slideSize ?? ref<CanvasSize>({ width: 960, height: 540 });

	const isPrintDialogOpen = ref(false);

	function openPrintDialog(): void {
		isPrintDialogOpen.value = true;
	}

	function closePrintDialog(): void {
		isPrintDialogOpen.value = false;
	}

	async function print(settings: PrintSettings): Promise<void> {
		isPrintDialogOpen.value = false;

		const slideList = slides.value;
		const colorFilter = computeColorFilter(settings.colorMode);
		const slideIndices = computeSlideIndices(
			settings.slideRange,
			activeSlideIndex.value,
			slideList.length,
			settings.customRangeFrom,
			settings.customRangeTo,
		);

		// ── Outline: text-only, no rasterisation needed ─────────────────────
		if (settings.printWhat === 'outline') {
			const outlineHtml = buildOutlineHtml(slideIndices, slideList);
			openWindow(
				buildPrintDocument(
					'Outline',
					`<div class="outline-page">${outlineHtml}</div>`,
					settings.orientation,
					colorFilter,
					settings.frameSlides,
				),
			);
			return;
		}

		if (slideIndices.length === 0) {
			return;
		}

		if (settings.printWhat === 'slides') {
			try {
				const { width, height } = slideSize.value;
				const svgs = slideIndices.map((index) => exportSlideToSvg(slideList[index], width, height));
				openWindow(
					buildSvgPrintDocument(svgs, width, height, {
						title: 'Slides (Vector)',
						orientation: settings.orientation,
						colorFilter,
					}),
				);
				return;
			} catch (err) {
				console.warn('[PowerPointViewer] SVG print failed, falling back to raster:', err);
			}
		}

		try {
			// Rasterise each selected slide to a PNG data URL.
			const images: string[] = [];
			for (const idx of slideIndices) {
				const canvas = await rasterizeSlide(idx);
				images.push(canvas.toDataURL('image/png'));
			}
			if (settings.printWhat === 'slides') {
				openWindow(
					buildPrintDocument(
						'Slides',
						buildSlidesHtml(images, slideIndices),
						settings.orientation,
						colorFilter,
						settings.frameSlides,
					),
				);
				return;
			}

			if (settings.printWhat === 'notes') {
				openWindow(
					buildPrintDocument(
						'Notes Pages',
						buildNotesHtml(images, slideIndices, slideList),
						'portrait',
						colorFilter,
						settings.frameSlides,
					),
				);
				return;
			}

			// ── Handouts ─────────────────────────────────────────────────────
			const spp = settings.slidesPerPage;
			openWindow(
				buildPrintDocument(
					`Handout ${spp} per page`,
					buildHandoutsHtml(images, slideIndices, spp),
					'portrait',
					colorFilter,
					settings.frameSlides,
				),
			);
		} catch (err) {
			console.error('[PowerPointViewer] Print layout failed:', err);
		}
	}

	return { isPrintDialogOpen, openPrintDialog, closePrintDialog, print };
}
