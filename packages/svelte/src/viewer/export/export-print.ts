import type { PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize, PrintSettings } from 'pptx-viewer-shared';
import {
	buildHandoutsHtml,
	buildNotesHtml,
	buildOutlineHtml,
	buildPrintDocument,
	buildPrintHtmlDocument,
	computeColorFilter,
	computeSlideIndices,
	filterHiddenSlideIndices,
	validatePrintSettings,
} from 'pptx-viewer-shared';

import type { RasterizeSlide } from './export-controller.svelte';
import { exportSlideToSvg } from './export-svg';

/**
 * Print flow: assemble the shared print document (slides / notes / handouts /
 * outline) and hand it to a print surface. All the pure logic is shared and
 * DOMPurify-hardened: `validatePrintSettings` normalises the caller's partial
 * settings, `computeSlideIndices` / `computeColorFilter` resolve the range and
 * colour mode, the `build*Html` helpers produce the escaped body markup, and
 * `buildPrintHtmlDocument` sanitises + assembles the final document. This
 * module (the Svelte counterpart of Vue's `usePrint`) exports direct slide
 * pages as vector SVG, rasterises notes/handout thumbnails, and opens the
 * print surface.
 *
 * **Print surface / popup-blocker caveats:** the default opener renders the
 * document into a hidden same-origin `<iframe srcdoc>` and calls
 * `contentWindow.print()`, so no popup window is involved and popup blockers
 * cannot interfere (`document.write` is avoided too). A host that prefers a
 * visible print window can inject its own {@link OpenPrintWindow} via the
 * controller deps; note that a `window.open`-based opener only succeeds inside
 * a user gesture (a click handler) and returns `null` under popup blockers,
 * in which case it should report `false` so the flow resolves `false` and the
 * host can surface "allow popups for this site" guidance.
 */

/** Options for the print flow: any subset of the shared print settings. */
export type PrintOptions = Partial<PrintSettings>;

/**
 * Render a complete HTML document into a print surface and trigger printing.
 * Returns `false` when the surface could not be opened (e.g. a custom
 * `window.open`-based opener hit a popup blocker).
 */
export type OpenPrintWindow = (htmlDocument: string) => boolean;

/** Injected dependencies (kept DOM-light for unit tests). */
export interface PrintDeps {
	/** Live slide list; read fresh on every call. */
	getSlides(): PptxSlide[];
	/** Active slide index (0-based); target of the `current` slide range. */
	getCurrent(): number;
	/** Live slide dimensions used by the core SVG exporter. */
	getCanvasSize(): CanvasSize;
	rasterizeSlide: RasterizeSlide;
	/** Print-surface opener override (test seam / host popup handling). */
	openPrintWindow?: OpenPrintWindow;
	/** Options > Advanced > "Print hidden slides". Defaults to `false` (excluded), matching PowerPoint. */
	getIncludeHiddenSlides?(): boolean;
	/** Options > Advanced > "High quality" raster scale for the print fallback path. */
	getPrintHighQuality?(): boolean;
}

/** How long the hidden print iframe survives if `afterprint` never fires. */
const PRINT_FRAME_FALLBACK_TTL_MS = 60_000;

/**
 * Default opener: mount the document in a hidden same-origin iframe (via
 * `srcdoc`, no `document.write`) and print its content window. The frame is
 * removed after `afterprint`, with a TTL fallback for browsers that never
 * fire it on iframe windows.
 */
export function defaultOpenPrintWindow(htmlDocument: string): boolean {
	const frame = document.createElement('iframe');
	frame.setAttribute('aria-hidden', 'true');
	Object.assign(frame.style, {
		position: 'fixed',
		right: '0',
		bottom: '0',
		width: '0',
		height: '0',
		border: '0',
		visibility: 'hidden',
	});
	const cleanup = (): void => {
		setTimeout(() => frame.remove(), 500);
	};
	frame.addEventListener('load', () => {
		const win = frame.contentWindow;
		if (!win) {
			frame.remove();
			return;
		}
		win.addEventListener('afterprint', cleanup, { once: true });
		win.focus();
		win.print();
	});
	frame.srcdoc = htmlDocument;
	document.body.appendChild(frame);
	setTimeout(() => frame.remove(), PRINT_FRAME_FALLBACK_TTL_MS);
	return true;
}

/** Human-readable print-window titles per mode. */
function printTitle(settings: PrintSettings): string {
	if (settings.printWhat === 'notes') {
		return 'Notes Pages';
	}
	if (settings.printWhat === 'outline') {
		return 'Outline';
	}
	if (settings.printWhat === 'handouts') {
		return `Handout ${settings.slidesPerPage} per page`;
	}
	return 'Slides';
}

/**
 * Run the print flow for the given (partial) settings. Resolves `true` when
 * the print surface opened, `false` when there was nothing to print or the
 * opener reported failure (see the popup-blocker caveats above).
 */
export async function printSlides(deps: PrintDeps, options: PrintOptions = {}): Promise<boolean> {
	const slides = deps.getSlides();
	const settings = validatePrintSettings(options, slides.length);
	const openWindow = deps.openPrintWindow ?? defaultOpenPrintWindow;
	const colorFilter = computeColorFilter(settings.colorMode);
	const slideIndices = filterHiddenSlideIndices(
		computeSlideIndices(
			settings.slideRange,
			deps.getCurrent(),
			slides.length,
			settings.customRangeFrom,
			settings.customRangeTo,
		),
		slides,
		deps.getIncludeHiddenSlides?.() ?? false,
	);
	if (slideIndices.length === 0) {
		return false;
	}

	const assemble = (bodyHtml: string, portraitOnly = false): string =>
		buildPrintHtmlDocument({
			title: printTitle(settings),
			bodyHtml,
			orientation: portraitOnly ? 'portrait' : settings.orientation,
			colorFilter,
			frameSlides: settings.frameSlides,
			scaleToFit: settings.scaleToFit,
		});

	// Outline is text-only: no rasterisation needed.
	if (settings.printWhat === 'outline') {
		const outlineHtml = buildOutlineHtml(slideIndices, slides);
		return openWindow(assemble(`<div class="outline-page">${outlineHtml}</div>`, true));
	}

	// Full-page slides use the core data-model SVG exporter. This preserves
	// rich vector content such as chart marks and avoids DOM raster capture.
	if (settings.printWhat === 'slides') {
		const { width, height } = deps.getCanvasSize();
		const svgs = slideIndices.map((index) =>
			exportSlideToSvg(slides[index] as PptxSlide, width, height),
		);
		return openWindow(
			buildPrintDocument(svgs, width, height, {
				title: printTitle(settings),
				orientation: settings.orientation,
				colorFilter,
				scaleToFit: settings.scaleToFit,
			}),
		);
	}

	// Options > Advanced > "High quality" raster scale for this notes/handouts
	// fallback path, composed on top of the host's own baseline (2x * Options >
	// Advanced > Image Size/Quality) scale.
	const printScaleMultiplier = deps.getPrintHighQuality?.() ? 2 : 1;
	const images: string[] = [];
	for (const index of slideIndices) {
		const canvas = await deps.rasterizeSlide(index, printScaleMultiplier);
		images.push(canvas.toDataURL('image/png'));
	}

	if (settings.printWhat === 'notes') {
		return openWindow(assemble(buildNotesHtml(images, slideIndices, slides), true));
	}
	if (settings.printWhat === 'handouts') {
		return openWindow(
			assemble(buildHandoutsHtml(images, slideIndices, settings.slidesPerPage), true),
		);
	}
	return false;
}
