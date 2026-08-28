import type { PrintSettings } from 'pptx-viewer-shared';
import {
	buildHandoutsHtml,
	buildNotesHtml,
	buildOutlineHtml,
	buildPrintDocument,
	buildPrintHtmlDocument,
	computeColorFilter,
	computeSlideIndices,
	exportAbortError,
	filterHiddenSlideIndices,
	finishPrintWindow as finishPendingWindow,
	openPendingPrintWindow as openPendingWindow,
	openPrintWindow as defaultOpenPrintWindow,
	validatePrintSettings,
} from 'pptx-viewer-shared';

import { createTranslator } from '../i18n';
import { exportSlideToSvg } from './export-svg';
import type { ExportCaptureDeps, ExportProgress } from './export-types';

/**
 * Print for the vanilla binding, assembled entirely from the shared print
 * module (`pptx-viewer-shared` `print-document` + `print-window`):
 * `validatePrintSettings`, `computeSlideIndices` / `computeColorFilter`, the
 * `build*Html` body markup builders, the DOMPurify-hardened
 * `buildPrintHtmlDocument` assembler, and the popup-blocking-safe
 * open/finish window lifecycle. Only the drivers live here: rasterising the
 * selected slides to data URLs and deciding which path each print mode
 * takes. Vanilla port of Vue's `usePrint` raster path (slides / notes /
 * handouts / outline).
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
	const slideIndices = filterHiddenSlideIndices(
		computeSlideIndices(
			settings.slideRange,
			state.currentSlide,
			slides.length,
			settings.customRangeFrom,
			settings.customRangeTo,
		),
		slides,
		deps.getIncludeHiddenSlides?.() ?? false,
	);

	// Outline is text-only: no rasterisation needed.
	if (settings.printWhat === 'outline') {
		const bodyHtml = `<div class="outline-page">${buildOutlineHtml(slideIndices, slides)}</div>`;
		return openWindow(buildDocument('Outline', bodyHtml, settings, colorFilter));
	}

	if (slideIndices.length === 0) {
		return false;
	}

	if (settings.printWhat === 'slides') {
		const { width, height } = state.canvasSize;
		const svgs: string[] = [];
		for (let i = 0; i < slideIndices.length; i++) {
			if (signal?.aborted) {
				throw exportAbortError();
			}
			onProgress?.(i, slideIndices.length);
			svgs.push(exportSlideToSvg(slides[slideIndices[i]], width, height));
		}
		onProgress?.(slideIndices.length, slideIndices.length);
		return openWindow(
			buildPrintDocument(svgs, width, height, {
				title: 'Slides (Vector)',
				orientation: settings.orientation,
				colorFilter,
				scaleToFit: settings.scaleToFit,
			}),
		);
	}

	// Rasterising each slide below `await`s, so the default opener must grab
	// the window NOW, before that first await, or it gets popup-blocked. A
	// custom `openPrintWindow` owns its own timing and gets the finished
	// document in a single call, as documented.
	const t = deps.getTranslator?.() ?? createTranslator();
	const pendingWindow = openPrintWindow
		? undefined
		: openPendingWindow(t('pptx.print.preparingToPrint'));
	if (!openPrintWindow && !pendingWindow) {
		return false;
	}

	// Options > Advanced > "High quality" raster scale for this notes/handouts
	// fallback path, composed on top of the host's own baseline (2x * Options >
	// Advanced > Image Size/Quality) scale.
	const printScaleMultiplier = deps.getPrintHighQuality?.() ? 2 : 1;
	const images: string[] = [];
	for (let i = 0; i < slideIndices.length; i++) {
		if (signal?.aborted) {
			pendingWindow?.close();
			throw exportAbortError();
		}
		onProgress?.(i, slideIndices.length);
		const canvas = await deps.rasterizeSlide(slideIndices[i], printScaleMultiplier);
		images.push(canvas.toDataURL('image/png'));
	}
	onProgress?.(slideIndices.length, slideIndices.length);

	const commit = (html: string): boolean => {
		if (pendingWindow) {
			finishPendingWindow(pendingWindow, html);
			return true;
		}
		return openWindow(html);
	};

	if (settings.printWhat === 'notes') {
		const bodyHtml = buildNotesHtml(images, slideIndices, slides);
		return commit(buildDocument('Notes Pages', bodyHtml, settings, colorFilter));
	}
	const bodyHtml = buildHandoutsHtml(images, slideIndices, settings.slidesPerPage);
	const title = `Handout ${settings.slidesPerPage} per page`;
	return commit(buildDocument(title, bodyHtml, settings, colorFilter));
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
		scaleToFit: settings.scaleToFit,
	});
}
