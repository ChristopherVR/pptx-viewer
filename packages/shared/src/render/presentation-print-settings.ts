/**
 * Helpers for editing a presentation's default print/handout settings through
 * the typed `printProperties` (`p:prnPr`) surface.
 *
 * These replace the removed flat `PptxPresentationProperties.printSlidesPerPage`
 * / `.printFrameSlides` aliases: every binding's "Presentation Settings"
 * inspector reads and patches `printProperties` via these pure helpers so the
 * mapping between a handout slides-per-page count and the `printWhat`
 * enumeration lives in exactly one place.
 */
import type { PptxPresentationPrintProperties, PptxPrintOutput } from 'pptx-viewer-core';

/** PresentationML handout layouts, in ascending slides-per-page order. */
const HANDOUT_SLIDES_PER_PAGE = [1, 2, 3, 4, 6, 9] as const;

/**
 * Read the slides-per-page a handout `printWhat` encodes. Returns `1` when the
 * print target is not a handout layout (e.g. `slides`, `notes`, `outline`).
 */
export function printPropertiesSlidesPerPage(
	printProperties?: PptxPresentationPrintProperties | null,
): number {
	const match = printProperties?.printWhat?.match(/^handouts([123469])$/u);
	return match ? Number.parseInt(match[1], 10) : 1;
}

/** Read the frame-slides flag from typed print properties. */
export function printPropertiesFrameSlides(
	printProperties?: PptxPresentationPrintProperties | null,
): boolean {
	return Boolean(printProperties?.frameSlides);
}

/** Clamp an arbitrary count to the nearest supported handout layout. */
function nearestHandoutCount(value: number): (typeof HANDOUT_SLIDES_PER_PAGE)[number] {
	return HANDOUT_SLIDES_PER_PAGE.reduce((best, candidate) =>
		Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
	);
}

/**
 * Return a new print-properties object with `frameSlides` set, preserving every
 * other field.
 */
export function withFrameSlides(
	printProperties: PptxPresentationPrintProperties | null | undefined,
	value: boolean,
): PptxPresentationPrintProperties {
	return { ...(printProperties ?? {}), frameSlides: value };
}

/**
 * Return a new print-properties object whose `printWhat` encodes the requested
 * slides-per-page as a handout layout (clamped to a supported count).
 */
export function withSlidesPerPage(
	printProperties: PptxPresentationPrintProperties | null | undefined,
	value: number,
): PptxPresentationPrintProperties {
	const count = nearestHandoutCount(value);
	return { ...(printProperties ?? {}), printWhat: `handouts${count}` as PptxPrintOutput };
}
