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
} from 'pptx-viewer-shared';
import { useState } from 'react';
import type { RefObject } from 'react';

import type { PrintSettings } from '../components/print-dialog-types';
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
/*  Print Window Builder                                               */
/* ------------------------------------------------------------------ */

/**
 * Open a print window and write a full print document assembled by the
 * shared `buildPrintHtmlDocument` (title/orientation/colour-filter escaping
 * and body sanitisation live there once, reused by every binding).
 */
function openPrintWindow(
	title: string,
	bodyHtml: string,
	orientation: 'landscape' | 'portrait',
	colorFilter: string,
	frameSlides: boolean,
): boolean {
	const printWindow = window.open('', '_blank', 'noopener,noreferrer');
	if (!printWindow) {
		return false;
	}
	printWindow.document.open();
	printWindow.document.write(
		buildPrintHtmlDocument({ title, bodyHtml, orientation, colorFilter, frameSlides }),
	);
	printWindow.document.close();
	printWindow.focus();
	setTimeout(() => {
		printWindow.print();
	}, 300);
	return true;
}

/**
 * Open a print window with a full HTML document string.
 * Used for the SVG print path which builds its own document.
 */
function openPrintWindowWithDocument(htmlDocument: string): boolean {
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

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function usePrintHandlers(input: UsePrintHandlersInput): PrintHandlersResult {
	const { slides, activeSlideIndex, canvasStageRef, setActiveSlideIndex, pptxData } = input;
	const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

	const handlePrint = () => {
		setIsPrintDialogOpen(true);
	};

	/* ---------------------------------------------------------------- */
	/*  SVG-based print path (vector, DPI-independent)                   */
	/* ---------------------------------------------------------------- */

	const handlePrintSvg = async (settings: PrintSettings) => {
		setIsPrintDialogOpen(false);

		if (!pptxData || settings.printWhat !== 'slides') {
			// SVG path only supports direct slide printing when pptxData is available.
			// Fall back to raster path for notes/handouts/outline or when no data.
			return handlePrintWithSettings(settings);
		}

		const colorFilter = (() => {
			if (settings.colorMode === 'grayscale') {
				return 'filter: grayscale(1);';
			}
			if (settings.colorMode === 'blackAndWhite') {
				return 'filter: grayscale(1) contrast(2);';
			}
			return '';
		})();

		const slideIndices: number[] = (() => {
			if (settings.slideRange === 'current') {
				return [activeSlideIndex];
			}
			if (settings.slideRange === 'custom') {
				const from = Math.max(0, settings.customRangeFrom - 1);
				const to = Math.min(slides.length - 1, settings.customRangeTo - 1);
				return Array.from({ length: to - from + 1 }, (_, i) => from + i);
			}
			return Array.from({ length: slides.length }, (_, i) => i);
		})();

		try {
			// Export slides to SVG using the core SVG exporter
			const svgs = exportAllSlidesToSvg(pptxData, {
				slideIndices,
			});

			if (svgs.length === 0) {
				return;
			}

			// Build the print document
			const printDoc = buildPrintDocument(svgs, pptxData.width, pptxData.height, {
				title: 'Slides (Vector)',
				orientation: settings.orientation,
				colorFilter,
			});

			openPrintWindowWithDocument(printDoc);
		} catch (err) {
			console.warn('[PowerPointViewer] SVG print path failed, falling back to raster:', err);
			// Fall back to the raster path
			return handlePrintWithSettings(settings);
		}
	};

	/* ---------------------------------------------------------------- */
	/*  Raster-based print path (html2canvas, original)                  */
	/* ---------------------------------------------------------------- */

	const handlePrintWithSettings = async (settings: PrintSettings) => {
		setIsPrintDialogOpen(false);
		const colorFilter = (() => {
			if (settings.colorMode === 'grayscale') {
				return 'filter: grayscale(1);';
			}
			if (settings.colorMode === 'blackAndWhite') {
				return 'filter: grayscale(1) contrast(2);';
			}
			return '';
		})();

		const slideIndices: number[] = (() => {
			if (settings.slideRange === 'current') {
				return [activeSlideIndex];
			}
			if (settings.slideRange === 'custom') {
				const from = Math.max(0, settings.customRangeFrom - 1);
				const to = Math.min(slides.length - 1, settings.customRangeTo - 1);
				return Array.from({ length: to - from + 1 }, (_, i) => from + i);
			}
			return Array.from({ length: slides.length }, (_, i) => i);
		})();

		if (settings.printWhat === 'outline') {
			openPrintWindow(
				'Outline',
				`<div class="outline-page">${buildOutlineHtml(slideIndices, slides)}</div>`,
				settings.orientation,
				colorFilter,
				settings.frameSlides,
			);
			return;
		}

		try {
			if (!canvasStageRef.current) {
				return;
			}
			const allImages = await captureAllSlidesAsPngDataUrls(
				canvasStageRef,
				slides.length,
				setActiveSlideIndex,
				activeSlideIndex,
				{ scale: 3 },
			);
			if (allImages.length === 0) {
				return;
			}
			const slideImages = slideIndices.map((idx) => allImages[idx]).filter(Boolean) as string[];

			if (settings.printWhat === 'slides') {
				openPrintWindow(
					'Slides',
					buildSlidesHtml(slideImages, slideIndices),
					settings.orientation,
					colorFilter,
					settings.frameSlides,
				);
				return;
			}

			if (settings.printWhat === 'notes') {
				openPrintWindow(
					'Notes Pages',
					buildNotesHtml(slideImages, slideIndices, slides),
					'portrait',
					colorFilter,
					settings.frameSlides,
				);
				return;
			}

			if (settings.printWhat === 'handouts') {
				const spp = settings.slidesPerPage;
				openPrintWindow(
					`Handout ${spp} per page`,
					buildHandoutsHtml(slideImages, slideIndices, spp),
					'portrait',
					colorFilter,
					settings.frameSlides,
				);
			}
		} catch (err) {
			console.error('[PowerPointViewer] Print layout failed:', err);
		}
	};

	return {
		handlePrint,
		handlePrintWithSettings,
		handlePrintSvg,
		isPrintDialogOpen,
		setIsPrintDialogOpen,
	};
}
