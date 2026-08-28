import type { PptxSlide } from 'pptx-viewer-core';
import {
	buildHandoutsHtml,
	buildNotesHtml,
	buildPrintDocument as buildSvgPrintDocument,
	buildPrintHtmlDocument,
	buildSlidesHtml,
	DEFAULT_VIEWER_OPTIONS,
	filterHiddenSlideIndices,
	finishPrintWindow as finishPendingPrintWindow,
	openPendingPrintWindow,
} from 'pptx-viewer-shared';
import { inject, ref } from 'vue';
import type { Ref } from 'vue';

import {
	buildOutlineHtml,
	computeColorFilter,
	computeSlideIndices,
} from '../components/print-dialog-types';
import type { PrintSettings } from '../components/print-dialog-types';
import { exportSlideToSvg } from '../export-svg';
import type { CanvasSize } from '../types';
import { useSafeTranslate } from './useSafeTranslate';
import { ViewerOptionsKey } from './useViewerOptionsStore';

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

/**
 * Rasterise the slide at `index` to a canvas. Host-supplied (DOM-coupled).
 * `scaleMultiplier` (default 1) is an extra factor the Print dialog's
 * notes/handouts raster path applies on top of the host's own baseline scale
 * when Options > Advanced > "High quality" is on.
 */
export type RasterizeSlide = (
	index: number,
	scaleMultiplier?: number,
) => Promise<HTMLCanvasElement>;

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
	scaleToFit: boolean | undefined,
): string {
	return buildPrintHtmlDocument({
		title,
		bodyHtml,
		orientation,
		colorFilter,
		frameSlides,
		scaleToFit,
	});
}

export function usePrint(options: UsePrintOptions): UsePrintResult {
	const { slides, activeSlideIndex, rasterizeSlide } = options;
	// A custom opener gets the complete document in one call, as documented;
	// only the default `window.open` path gets the early-open popup-blocking
	// fix (see `openPendingPrintWindow`), since it owns the window's timing.
	const customOpenWindow = options.openPrintWindow;
	const slideSize = options.slideSize ?? ref<CanvasSize>({ width: 960, height: 540 });
	const t = useSafeTranslate();
	const injectedViewerOptions = inject(ViewerOptionsKey, undefined);

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
		const viewerOptions = injectedViewerOptions?.value ?? DEFAULT_VIEWER_OPTIONS;
		const slideIndices = filterHiddenSlideIndices(
			computeSlideIndices(
				settings.slideRange,
				activeSlideIndex.value,
				slideList.length,
				settings.customRangeFrom,
				settings.customRangeTo,
			),
			slideList,
			viewerOptions.advanced.printHiddenSlides,
		);

		// ── Outline: text-only, no rasterisation needed ─────────────────────
		if (settings.printWhat === 'outline') {
			const outlineHtml = buildOutlineHtml(slideIndices, slideList);
			(customOpenWindow ?? defaultOpenPrintWindow)(
				buildPrintDocument(
					'Outline',
					`<div class="outline-page">${outlineHtml}</div>`,
					settings.orientation,
					colorFilter,
					settings.frameSlides,
					settings.scaleToFit,
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
				(customOpenWindow ?? defaultOpenPrintWindow)(
					buildSvgPrintDocument(svgs, width, height, {
						title: 'Slides (Vector)',
						orientation: settings.orientation,
						colorFilter,
						scaleToFit: settings.scaleToFit,
					}),
				);
				return;
			} catch (err) {
				console.warn('[PowerPointViewer] SVG print failed, falling back to raster:', err);
			}
		}

		// From here on the raster path awaits `rasterizeSlide` per slide, so the
		// default opener must grab the window NOW, before that first await, or
		// the browser silently blocks it as a popup. A host-supplied opener owns
		// its own timing (see `customOpenWindow` above).
		const pendingWindow = customOpenWindow
			? undefined
			: openPendingPrintWindow(t('pptx.print.preparingToPrint'));
		if (!customOpenWindow && !pendingWindow) {
			console.warn(
				'[PowerPointViewer] Print window was blocked by the browser. Allow popups for this site to print.',
			);
			return;
		}
		const commit = (html: string): void => {
			if (pendingWindow) {
				finishPendingPrintWindow(pendingWindow, html);
			} else {
				customOpenWindow?.(html);
			}
		};

		try {
			// Options > Advanced > "High quality" raster scale for this
			// notes/handouts fallback path, composed on top of the host's own
			// baseline (2x * Options > Advanced > Image Size/Quality) scale.
			const printScaleMultiplier = viewerOptions.advanced.printHighQuality ? 2 : 1;
			// Rasterise each selected slide to a PNG data URL.
			const images: string[] = [];
			for (const idx of slideIndices) {
				const canvas = await rasterizeSlide(idx, printScaleMultiplier);
				images.push(canvas.toDataURL('image/png'));
			}
			if (settings.printWhat === 'slides') {
				commit(
					buildPrintDocument(
						'Slides',
						buildSlidesHtml(images, slideIndices),
						settings.orientation,
						colorFilter,
						settings.frameSlides,
						settings.scaleToFit,
					),
				);
				return;
			}

			if (settings.printWhat === 'notes') {
				commit(
					buildPrintDocument(
						'Notes Pages',
						buildNotesHtml(images, slideIndices, slideList),
						'portrait',
						colorFilter,
						settings.frameSlides,
						settings.scaleToFit,
					),
				);
				return;
			}

			// ── Handouts ─────────────────────────────────────────────────────
			const spp = settings.slidesPerPage;
			commit(
				buildPrintDocument(
					`Handout ${spp} per page`,
					buildHandoutsHtml(images, slideIndices, spp),
					'portrait',
					colorFilter,
					settings.frameSlides,
					settings.scaleToFit,
				),
			);
		} catch (err) {
			console.error('[PowerPointViewer] Print layout failed:', err);
			pendingWindow?.close();
		}
	}

	return { isPrintDialogOpen, openPrintDialog, closePrintDialog, print };
}
