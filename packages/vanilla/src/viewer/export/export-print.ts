import type { PrintSettings } from 'pptx-viewer-shared';
import {
	buildHandoutsHtml,
	buildNotesHtml,
	buildOutlineHtml,
	buildPrintHtmlDocument,
	buildSlidesHtml,
	computeColorFilter,
	computeSlideIndices,
	exportAbortError,
	validatePrintSettings,
} from 'pptx-viewer-shared';

import type { ExportCaptureDeps, ExportProgress } from './export-types';

/**
 * Print for the vanilla binding, assembled entirely from the shared print
 * module (`pptx-viewer-shared` `print-document`): `validatePrintSettings`,
 * `computeSlideIndices` / `computeColorFilter`, the `build*Html` body markup
 * builders, and the DOMPurify-hardened `buildPrintHtmlDocument` assembler.
 * Only the drivers live here: rasterising the selected slides to data URLs and
 * writing the document into a print window. Vanilla port of Vue's `usePrint`
 * raster path (slides / notes / handouts / outline).
 */

/**
 * Open a print window for a complete HTML document and trigger printing.
 * Returns `false` when the window could not be opened (popup blocker).
 */
export type OpenPrintWindow = (htmlDocument: string) => boolean;

/**
 * Options for `print`: any subset of the shared `PrintSettings` (unspecified
 * fields fall back to `DEFAULT_PRINT_SETTINGS`, i.e. all slides, landscape,
 * full colour) plus progress/abort and a print-window override.
 */
export interface PrintOptions extends Partial<PrintSettings> {
	/** Rasterisation progress callback: `(currentSlide, totalSlidesToPrint)`. */
	onProgress?: ExportProgress;
	/** Abort before the window opens; checked between slide captures. */
	signal?: AbortSignal;
	/**
	 * Override how the assembled document is opened (e.g. write it into a
	 * hidden iframe). Popup-blocker caveat: the default opener uses
	 * `window.open`, which browsers typically only allow inside a user
	 * gesture, so call `print()` from a click handler; when the popup is
	 * blocked the returned promise resolves `false`.
	 */
	openPrintWindow?: OpenPrintWindow;
}

/**
 * Default print-window opener: writes a full HTML doc and calls `print()`.
 * Matches Vue's `usePrint`. `document.write` is safe here: the target is a
 * fresh `about:blank` window this function just opened (never the host page),
 * and the document string comes from the shared `buildPrintHtmlDocument`,
 * which DOMPurify-sanitises the body and escapes every interpolated value.
 */
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
 * Assemble the printable HTML document for the (validated) settings and open
 * it in a print window. Resolves `true` when the window opened, `false` when
 * it was blocked or nothing matched the slide range. Throws the shared
 * `AbortError` when `signal` aborts between slide captures.
 */
export async function runPrint(
	deps: ExportCaptureDeps,
	options: PrintOptions = {},
): Promise<boolean> {
	const { onProgress, signal, openPrintWindow, ...partialSettings } = options;
	const openWindow = openPrintWindow ?? defaultOpenPrintWindow;
	const state = deps.store.get();
	const slides = state.slides;
	const settings = validatePrintSettings(partialSettings, slides.length);
	const colorFilter = computeColorFilter(settings.colorMode);
	const slideIndices = computeSlideIndices(
		settings.slideRange,
		state.currentSlide,
		slides.length,
		settings.customRangeFrom,
		settings.customRangeTo,
	);

	// Outline is text-only: no rasterisation needed.
	if (settings.printWhat === 'outline') {
		const bodyHtml = `<div class="outline-page">${buildOutlineHtml(slideIndices, slides)}</div>`;
		return openWindow(buildDocument('Outline', bodyHtml, settings, colorFilter));
	}

	if (slideIndices.length === 0) {
		return false;
	}

	const images: string[] = [];
	for (let i = 0; i < slideIndices.length; i++) {
		if (signal?.aborted) {
			throw exportAbortError();
		}
		onProgress?.(i, slideIndices.length);
		const canvas = await deps.rasterizeSlide(slideIndices[i]);
		images.push(canvas.toDataURL('image/png'));
	}
	onProgress?.(slideIndices.length, slideIndices.length);

	if (settings.printWhat === 'slides') {
		const bodyHtml = buildSlidesHtml(images, slideIndices);
		return openWindow(buildDocument('Slides', bodyHtml, settings, colorFilter));
	}
	if (settings.printWhat === 'notes') {
		const bodyHtml = buildNotesHtml(images, slideIndices, slides);
		return openWindow(buildDocument('Notes Pages', bodyHtml, settings, colorFilter));
	}
	const bodyHtml = buildHandoutsHtml(images, slideIndices, settings.slidesPerPage);
	const title = `Handout ${settings.slidesPerPage} per page`;
	return openWindow(buildDocument(title, bodyHtml, settings, colorFilter));
}

/**
 * Wrap the body in the shared full-document assembler. `settings` comes from
 * `validatePrintSettings`, which already forces portrait orientation for the
 * non-`slides` modes.
 */
function buildDocument(
	title: string,
	bodyHtml: string,
	settings: PrintSettings,
	colorFilter: string,
): string {
	return buildPrintHtmlDocument({
		title,
		bodyHtml,
		orientation: settings.orientation,
		colorFilter,
		frameSlides: settings.frameSlides,
	});
}
