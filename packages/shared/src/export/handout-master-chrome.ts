/**
 * Pure handout-master "chrome" descriptor: resolves the handout master's
 * background, header/footer/date/page-number placeholder text, and (when the
 * master defines them) the slide-image placeholder rects, into a
 * framework-neutral shape every binding's print path can paint.
 *
 * PowerPoint's Print > Handouts output is not a bare N-per-page grid: it
 * honours the handout master's background, prints its header/footer/date/
 * page-number placeholders wherever the master's `<p:hf>` flags leave them
 * enabled, and (rare, but legal OOXML) can size the slide cells from the
 * master's own placeholder geometry instead of an app-computed grid. This
 * module resolves all of that; `print-document.ts`'s `buildHandoutsHtml`
 * paints the result into the printed page.
 *
 * Geometry convention: every rect is expressed as page-fraction coordinates
 * (`0..1`), matching `master-page-layout.ts`'s `NOTES_MASTER_PLACEHOLDER_RECTS`
 * / `computeHandoutSlotLayout` and the handout/notes master canvas editors
 * that already draw the same four corner boxes for editing. Reusing those
 * fractions keeps the printed chrome consistent with what the master view
 * shows while editing.
 */
import type {
	PptxElement,
	PptxHandoutMaster,
	PptxPlaceholderFrame,
	TextSegment,
} from 'pptx-viewer-core';

import {
	DEFAULT_MASTER_PAGE_SIZE,
	NOTES_MASTER_PLACEHOLDER_RECTS,
} from '../render/master-page-layout';
import type { MasterPageRect } from '../render/master-page-layout';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** A resolved, positioned chrome box (header/footer/date/page-number text). */
export interface HandoutChromeBox {
	/** Resolved plain text (field placeholders already substituted). */
	text: string;
	/** Page-fraction rect (`0..1`). */
	rect: MasterPageRect;
}

/** Resolved background paint for the handout master. */
export interface HandoutChromeBackground {
	color?: string;
	imageDataUrl?: string;
}

/** Per-page inputs the chrome resolution needs. */
export interface HandoutMasterChromeOptions {
	/** Zero-based index of this handout page within the print job. */
	pageIndex: number;
	/** Total handout page count in the print job. */
	pageCount: number;
	/** Wall-clock time stamped onto an auto (`datetime`) date field. Defaults to `new Date()`. */
	printedAt?: Date;
	/** BCP-47 locale for formatting the auto date. Defaults to `en-US`. */
	locale?: string;
}

/** Framework-neutral handout master chrome for a single printed page. */
export interface HandoutMasterChrome {
	background?: HandoutChromeBackground;
	header?: HandoutChromeBox;
	footer?: HandoutChromeBox;
	date?: HandoutChromeBox;
	pageNumber?: HandoutChromeBox;
	/**
	 * Slide-cell rects (page fractions), only when the master's own shape tree
	 * defines fully-positioned slide-image placeholders. `undefined` when it
	 * does not, so the caller keeps computing its own app grid
	 * (`computeHandoutSlotLayout`).
	 */
	slideRects?: MasterPageRect[];
}

/* ------------------------------------------------------------------ */
/*  Text extraction                                                    */
/* ------------------------------------------------------------------ */

function segmentsToText(segments: TextSegment[] | undefined): string {
	return segments?.map((segment) => segment.text ?? '').join('') ?? '';
}

function elementText(element: PptxElement): string {
	const withText = element as PptxElement & { text?: string; textSegments?: TextSegment[] };
	return segmentsToText(withText.textSegments) || withText.text || '';
}

function elementFieldType(element: PptxElement): string | undefined {
	const withSegments = element as PptxElement & { textSegments?: TextSegment[] };
	return withSegments.textSegments?.find((segment) => segment.fieldType)?.fieldType;
}

/** `PptxElement.placeholderType` is lower-cased by the core parser (see P-H3). */
function findPlaceholderElement(
	elements: PptxElement[] | undefined,
	placeholderType: string,
): PptxElement | undefined {
	return elements?.find((element) => element.placeholderType === placeholderType);
}

/* ------------------------------------------------------------------ */
/*  Date formatting                                                    */
/* ------------------------------------------------------------------ */

const FALLBACK_LOCALE = 'en-US';

function formatPrintedDate(date: Date, locale: string | undefined): string {
	try {
		return new Intl.DateTimeFormat(locale ?? FALLBACK_LOCALE, { dateStyle: 'long' }).format(date);
	} catch {
		return date.toDateString();
	}
}

/* ------------------------------------------------------------------ */
/*  Slide-placeholder rects                                            */
/* ------------------------------------------------------------------ */

/**
 * Slide-image placeholders (`ST_PlaceholderType` `sldImg`) with a fully
 * authored `a:xfrm`, sorted by `@idx`, converted to page-fraction rects.
 * Real-world handout masters almost never author these (the slide grid is
 * normally computed by the app from `slidesPerPage`), but the format allows
 * it, and when present PowerPoint sizes the printed cells from them.
 */
function slideRectsFromPlaceholders(
	placeholders: PptxPlaceholderFrame[] | undefined,
): MasterPageRect[] | undefined {
	if (!placeholders) {
		return undefined;
	}
	const positioned = placeholders
		.filter(
			(placeholder) =>
				placeholder.type.trim().toLowerCase() === 'sldimg' &&
				placeholder.x !== undefined &&
				placeholder.y !== undefined &&
				placeholder.width !== undefined &&
				placeholder.height !== undefined,
		)
		.sort((a, b) => Number(a.idx ?? 0) - Number(b.idx ?? 0));
	if (positioned.length === 0) {
		return undefined;
	}
	const { width: pageW, height: pageH } = DEFAULT_MASTER_PAGE_SIZE;
	return positioned.map((placeholder) => ({
		x: (placeholder.x ?? 0) / pageW,
		y: (placeholder.y ?? 0) / pageH,
		w: (placeholder.width ?? 0) / pageW,
		h: (placeholder.height ?? 0) / pageH,
	}));
}

/* ------------------------------------------------------------------ */
/*  Chrome resolution                                                  */
/* ------------------------------------------------------------------ */

/**
 * Resolve the handout master's chrome for a single printed page: background,
 * header/footer/date/page-number boxes, and slide-cell rects.
 *
 * A part is only emitted when BOTH the master's `<p:hf>` flag for it is not
 * `false` (spec default is "shown") AND its placeholder shape actually
 * exists in `handoutMaster.elements` (a deck can flip the flag on with no
 * placeholder shape to draw, in which case there is nothing to print).
 */
export function handoutMasterChrome(
	handoutMaster: PptxHandoutMaster | undefined,
	options: HandoutMasterChromeOptions,
): HandoutMasterChrome {
	if (!handoutMaster) {
		return {};
	}

	const chrome: HandoutMasterChrome = {};

	if (handoutMaster.backgroundColor || handoutMaster.backgroundImage) {
		chrome.background = {
			color: handoutMaster.backgroundColor,
			imageDataUrl: handoutMaster.backgroundImage,
		};
	}

	const hf = handoutMaster.headerFooter;
	const elements = handoutMaster.elements;

	const headerElement = findPlaceholderElement(elements, 'hdr');
	if (hf?.hasHeader !== false && headerElement) {
		chrome.header = { text: elementText(headerElement), rect: NOTES_MASTER_PLACEHOLDER_RECTS.hdr };
	}

	const footerElement = findPlaceholderElement(elements, 'ftr');
	if (hf?.hasFooter !== false && footerElement) {
		chrome.footer = { text: elementText(footerElement), rect: NOTES_MASTER_PLACEHOLDER_RECTS.ftr };
	}

	const dateElement = findPlaceholderElement(elements, 'dt');
	if (hf?.hasDateTime !== false && dateElement) {
		const rawText = elementText(dateElement);
		const isAutoDate = elementFieldType(dateElement) === 'datetime' || rawText.trim() === '';
		const text = isAutoDate
			? formatPrintedDate(options.printedAt ?? new Date(), options.locale)
			: rawText;
		chrome.date = { text, rect: NOTES_MASTER_PLACEHOLDER_RECTS.dt };
	}

	const pageNumberElement = findPlaceholderElement(elements, 'sldnum');
	if (hf?.hasSlideNumber !== false && pageNumberElement) {
		chrome.pageNumber = {
			text: String(options.pageIndex + 1),
			rect: NOTES_MASTER_PLACEHOLDER_RECTS.sldNum,
		};
	}

	// Only set when the master itself authors positioned slide-image
	// placeholders (rare); otherwise leave the key absent so the caller keeps
	// its own app-computed grid (`getHandoutGrid` / `computeHandoutSlotLayout`)
	// rather than silently changing every deck's handout layout just because
	// it happens to have a handout master (nearly every deck does).
	const slideRects = slideRectsFromPlaceholders(handoutMaster.placeholders);
	if (slideRects) {
		chrome.slideRects = slideRects;
	}

	return chrome;
}
