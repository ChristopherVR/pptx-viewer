/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (many independent short-lived `const`s per handler); merging them isn't a
   style choice here. */
import type { PptxSlide, PptxData } from 'pptx-viewer-core';
/**
 * usePrintHandlers -- Print dialog and print-with-settings logic for
 * slides, notes, handouts, and outline layouts.
 *
 * Supports two print paths:
 * 1. **Raster path** (default): Captures each slide via html2canvas as a PNG
 *    data URL, then builds an HTML print document with `<img>` tags.
 *    Good compatibility but limited by html2canvas CSS support.
 *
 * 2. **SVG vector path**: Serializes each slide's DOM to SVG via
 *    `<foreignObject>`, producing resolution-independent print output
 *    that stays sharp at any DPI. Falls back to raster on error.
 */
import {
	buildHandoutsHtml,
	buildNotesHtml,
	buildOutlineHtml,
	buildPrintHtmlDocument,
	buildSlidesHtml,
	computeColorFilter,
	computeSlideIndices,
	filterHiddenSlideIndices,
	finishPrintWindow,
	openPendingPrintWindow,
	resolveImageResolutionScale,
} from 'pptx-viewer-shared';
import { useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { PrintSettings } from '../components/print-dialog-types';
import { useViewerOptionsContext } from '../components/viewer-options-context';
import { captureAllSlidesAsPngDataUrls } from '../utils/export';
import { exportAllSlidesToSvg } from '../utils/export-svg';
import { buildPrintDocument } from '../utils/svg-print-serializer';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface UsePrintHandlersInput {
	slides: PptxSlide[];
	activeSlideIndex: number;
	canvasStageRef: RefObject<HTMLDivElement | null>;
	setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
	/** Parsed PPTX data (needed for SVG print path). Optional for backward compat. */
	pptxData?: PptxData;
}

export interface PrintHandlersResult {
	handlePrint: () => void;
	handlePrintWithSettings: (settings: PrintSettings) => Promise<void>;
	handlePrintSvg: (settings: PrintSettings) => Promise<void>;
	isPrintDialogOpen: boolean;
	setIsPrintDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function usePrintHandlers(input: UsePrintHandlersInput): PrintHandlersResult {
	const { slides, activeSlideIndex, canvasStageRef, setActiveSlideIndex, pptxData } = input;
	const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
	const { t } = useTranslation();
	const viewerOptions = useViewerOptionsContext();
	// Options > Advanced > "Print hidden slides".
	const includeHiddenSlides = viewerOptions.advanced.printHiddenSlides;
	// Options > Advanced > "High quality" raster scale for the print fallback
	// path (notes/handouts/outline, or slides when the SVG path errors),
	// composed with Options > Advanced > Image Size/Quality's own resolution
	// scale so the two settings multiply rather than fight each other.
	const printRasterScale =
		(viewerOptions.advanced.printHighQuality ? 4 : 3) * resolveImageResolutionScale(viewerOptions);

	const handlePrint = () => {
		setIsPrintDialogOpen(true);
	};

	/* ---------------------------------------------------------------- */
	/*  SVG-based print path (vector, DPI-independent)                   */
	/* ---------------------------------------------------------------- */

	/**
	 * Single entry point for the "Print" button inside `PrintDialog`. Opens
	 * the print window FIRST, synchronously, still within that click's user
	 * gesture (see `openPendingPrintWindow`), then decides which path fills
	 * it in: SVG (vector, no DOM/live-state touching at all -- the only path
	 * with no visible slide-flicker) when printing slides with parsed data
	 * available, the raster (html2canvas) path otherwise.
	 */
	const handlePrintSvg = async (settings: PrintSettings) => {
		setIsPrintDialogOpen(false);
		const printWindow = openPendingPrintWindow(t('pptx.print.preparingToPrint'));
		if (!printWindow) {
			console.warn(
				'[PowerPointViewer] Print window was blocked by the browser. Allow popups for this site to print.',
			);
			return;
		}

		if (!pptxData || settings.printWhat !== 'slides') {
			// SVG path only supports direct slide printing when pptxData is available.
			// Fall back to raster path for notes/handouts/outline or when no data.
			return runRasterPrint(printWindow, settings);
		}

		const colorFilter = computeColorFilter(settings.colorMode);

		const slideIndices: number[] = filterHiddenSlideIndices(
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

		try {
			// Export slides to SVG using the core SVG exporter
			const svgs = exportAllSlidesToSvg(pptxData, {
				slideIndices,
			});

			if (svgs.length === 0) {
				printWindow.close();
				return;
			}

			// Build the print document
			const printDoc = buildPrintDocument(svgs, pptxData.width, pptxData.height, {
				title: 'Slides (Vector)',
				orientation: settings.orientation,
				colorFilter,
				scaleToFit: settings.scaleToFit,
			});

			finishPrintWindow(printWindow, printDoc);
		} catch (err) {
			console.warn('[PowerPointViewer] SVG print path failed, falling back to raster:', err);
			// Fall back to the raster path, reusing the same already-open window.
			return runRasterPrint(printWindow, settings);
		}
	};

	/* ---------------------------------------------------------------- */
	/*  Raster-based print path (html2canvas, original)                  */
	/* ---------------------------------------------------------------- */

	/**
	 * Renders each requested slide via html2canvas and writes the result into
	 * `printWindow` (already open -- see `handlePrintSvg`). Used directly for
	 * notes/handouts/outline, and as the SVG path's fallback.
	 *
	 * Slides/notes/handouts must each be visible in the live canvas to be
	 * captured, so this still switches `activeSlideIndex` through every slide
	 * (the original slide is restored once done) -- unlike the SVG path,
	 * this is not flicker-free. There is no vector source for a rendered
	 * notes/handout layout to draw from instead.
	 */
	const runRasterPrint = async (printWindow: Window, settings: PrintSettings) => {
		const colorFilter = computeColorFilter(settings.colorMode);

		const slideIndices: number[] = filterHiddenSlideIndices(
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

		if (settings.printWhat === 'outline') {
			finishPrintWindow(
				printWindow,
				buildPrintHtmlDocument({
					title: 'Outline',
					bodyHtml: `<div class="outline-page">${buildOutlineHtml(slideIndices, slides)}</div>`,
					orientation: settings.orientation,
					colorFilter,
					frameSlides: settings.frameSlides,
					scaleToFit: settings.scaleToFit,
				}),
			);
			return;
		}

		try {
			if (!canvasStageRef.current) {
				printWindow.close();
				return;
			}
			const allImages = await captureAllSlidesAsPngDataUrls(
				canvasStageRef,
				slides.length,
				setActiveSlideIndex,
				activeSlideIndex,
				{ scale: printRasterScale },
			);
			if (allImages.length === 0) {
				printWindow.close();
				return;
			}
			const slideImages = slideIndices.map((idx) => allImages[idx]).filter(Boolean) as string[];

			if (settings.printWhat === 'slides') {
				finishPrintWindow(
					printWindow,
					buildPrintHtmlDocument({
						title: 'Slides',
						bodyHtml: buildSlidesHtml(slideImages, slideIndices),
						orientation: settings.orientation,
						colorFilter,
						frameSlides: settings.frameSlides,
						scaleToFit: settings.scaleToFit,
					}),
				);
				return;
			}

			if (settings.printWhat === 'notes') {
				finishPrintWindow(
					printWindow,
					buildPrintHtmlDocument({
						title: 'Notes Pages',
						bodyHtml: buildNotesHtml(slideImages, slideIndices, slides),
						orientation: 'portrait',
						colorFilter,
						frameSlides: settings.frameSlides,
						scaleToFit: settings.scaleToFit,
					}),
				);
				return;
			}

			if (settings.printWhat === 'handouts') {
				const spp = settings.slidesPerPage;
				finishPrintWindow(
					printWindow,
					buildPrintHtmlDocument({
						title: `Handout ${spp} per page`,
						bodyHtml: buildHandoutsHtml(slideImages, slideIndices, spp, pptxData?.handoutMaster),
						orientation: 'portrait',
						colorFilter,
						frameSlides: settings.frameSlides,
						scaleToFit: settings.scaleToFit,
					}),
				);
			}
		} catch (err) {
			console.error('[PowerPointViewer] Print layout failed:', err);
		}
	};

	/**
	 * Public entry point for the raster path on its own (kept for API
	 * back-compat; `PrintDialog` itself goes through `handlePrintSvg`, which
	 * prefers the flicker-free SVG path and falls back to `runRasterPrint`
	 * directly, reusing the window it already opened rather than opening a
	 * second one here).
	 */
	const handlePrintWithSettings = async (settings: PrintSettings) => {
		setIsPrintDialogOpen(false);
		const printWindow = openPendingPrintWindow(t('pptx.print.preparingToPrint'));
		if (!printWindow) {
			console.warn(
				'[PowerPointViewer] Print window was blocked by the browser. Allow popups for this site to print.',
			);
			return;
		}
		return runRasterPrint(printWindow, settings);
	};

	return {
		handlePrint,
		handlePrintWithSettings,
		handlePrintSvg,
		isPrintDialogOpen,
		setIsPrintDialogOpen,
	};
}
