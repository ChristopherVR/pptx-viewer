/**
 * Pure print helpers shared by every binding's print path: settings validation,
 * slide-range / colour-filter resolution, page-count estimation, HTML markup
 * builders, escaping, and the full print-document assembler.
 *
 * No DOM side effects and no `window.print()`: everything is deterministic and
 * the binding writes the returned HTML string into a print window. The handout
 * grid geometry lives in `handout-layout`; this module reuses it.
 *
 * ng-packagr constraint honoured here (the Angular binding inlines this source
 * and compiles it through ng-packagr): NO `String.prototype.replaceAll`
 * (`escapeHtml` uses `.split(x).join(y)` instead).
 */

import type { PptxSlide } from 'pptx-viewer-core';

import { sanitizeMarkupOrEmpty } from '../render/dompurify-safe';
import { getHandoutGrid, HANDOUT_OPTIONS } from './handout-layout';
import type { HandoutSlidesPerPage } from './handout-layout';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** What to print. */
export type PrintWhat = 'slides' | 'handouts' | 'notes' | 'outline';

/** Page orientation for the printed output. */
export type PrintOrientation = 'portrait' | 'landscape';

/** Colour mode for the printed output. */
export type PrintColorMode = 'color' | 'grayscale' | 'blackAndWhite';

/** Slide range mode. */
export type PrintSlideRange = 'all' | 'current' | 'custom';

/** Resolved print settings emitted on confirm. */
export interface PrintSettings {
	printWhat: PrintWhat;
	orientation: PrintOrientation;
	colorMode: PrintColorMode;
	frameSlides: boolean;
	slidesPerPage: HandoutSlidesPerPage;
	slideRange: PrintSlideRange;
	customRangeFrom: number;
	customRangeTo: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Default print settings used when the dialog opens. */
export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
	printWhat: 'slides',
	orientation: 'landscape',
	colorMode: 'color',
	frameSlides: false,
	slidesPerPage: 6,
	slideRange: 'all',
	customRangeFrom: 1,
	customRangeTo: 1,
};

/** Number of ruled note lines drawn next to each slide in 3-per-page handouts. */
const NOTE_LINE_COUNT = 8;

/** Transparent 1x1 PNG used as a safe fallback for non-data image sources. */
const TRANSPARENT_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

/* ------------------------------------------------------------------ */
/*  Validation / normalisation                                         */
/* ------------------------------------------------------------------ */

/**
 * Coerce an arbitrary number to a supported {@link HandoutSlidesPerPage}.
 * Falls back to 6 (the PowerPoint default) when the value is unsupported.
 */
export function normalizeSlidesPerPage(value: number | undefined): HandoutSlidesPerPage {
	if (value !== undefined && HANDOUT_OPTIONS.includes(value as HandoutSlidesPerPage)) {
		return value as HandoutSlidesPerPage;
	}
	return 6;
}

/**
 * Validate and clamp partial print settings into a fully-resolved
 * {@link PrintSettings}. Custom-range bounds are clamped to `[1, slideCount]`
 * (with `from <= to`), and `notes`/`outline`/`handouts` force portrait
 * orientation.
 *
 * @param partial    - Caller-provided settings (any subset).
 * @param slideCount - Total number of slides in the presentation.
 */
export function validatePrintSettings(
	partial: Partial<PrintSettings>,
	slideCount: number,
): PrintSettings {
	const merged: PrintSettings = { ...DEFAULT_PRINT_SETTINGS, ...partial };
	const total = Math.max(0, Math.floor(slideCount));

	const slidesPerPage = normalizeSlidesPerPage(merged.slidesPerPage);

	const orientation = effectiveOrientation(merged.printWhat, merged.orientation);

	const maxIndex = Math.max(1, total);
	let from = Math.max(1, Math.min(Math.floor(merged.customRangeFrom) || 1, maxIndex));
	let to = Math.max(1, Math.min(Math.floor(merged.customRangeTo) || 1, maxIndex));
	if (to < from) {
		const swap = from;
		from = to;
		to = swap;
	}

	return {
		printWhat: merged.printWhat,
		orientation,
		colorMode: merged.colorMode,
		frameSlides: merged.frameSlides,
		slidesPerPage,
		slideRange: merged.slideRange,
		customRangeFrom: from,
		customRangeTo: to,
	};
}

/**
 * The orientation actually used for a given print mode. Only full-page
 * `slides` honour the user-chosen orientation; everything else is portrait.
 */
export function effectiveOrientation(
	printWhat: PrintWhat,
	orientation: PrintOrientation,
): PrintOrientation {
	if (printWhat === 'slides') {
		return orientation;
	}
	return 'portrait';
}

/* ------------------------------------------------------------------ */
/*  Slide-range / colour-filter helpers                                */
/* ------------------------------------------------------------------ */

/**
 * Compute the zero-based slide indices to print from a slide-range setting.
 * Custom ranges use 1-based, inclusive `from`/`to` and are clamped to bounds.
 */
export function computeSlideIndices(
	slideRange: PrintSlideRange,
	activeSlideIndex: number,
	slideCount: number,
	customRangeFrom: number,
	customRangeTo: number,
): number[] {
	if (slideRange === 'current') {
		return [activeSlideIndex];
	}
	if (slideRange === 'custom') {
		const from = Math.max(0, customRangeFrom - 1);
		const to = Math.min(slideCount - 1, customRangeTo - 1);
		return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
	}
	return Array.from({ length: slideCount }, (_, i) => i);
}

/**
 * Number of slides selected by the given range. Custom ranges use 1-based,
 * inclusive `from`/`to` clamped to `[1, slideCount]`; an inverted range
 * collapses to a single slide.
 */
export function computeSlideCount(
	slideRange: PrintSlideRange,
	slideCount: number,
	customRangeFrom: number,
	customRangeTo: number,
): number {
	if (slideRange === 'all') {
		return slideCount;
	}
	if (slideRange === 'current') {
		return 1;
	}
	const from = Math.max(1, Math.min(customRangeFrom, slideCount));
	const to = Math.max(from, Math.min(customRangeTo, slideCount));
	return to - from + 1;
}

/** CSS `filter:` declaration for the chosen colour mode (empty for full colour). */
export function computeColorFilter(colorMode: PrintColorMode): string {
	if (colorMode === 'grayscale') {
		return 'filter: grayscale(1);';
	}
	if (colorMode === 'blackAndWhite') {
		return 'filter: grayscale(1) contrast(2);';
	}
	return '';
}

/* ------------------------------------------------------------------ */
/*  Page-count estimation                                              */
/* ------------------------------------------------------------------ */

/** Number of pages needed for `slideCount` slides at `slidesPerPage`. */
export function computePrintPageCount(
	slideCount: number,
	slidesPerPage: HandoutSlidesPerPage,
): number {
	if (slideCount <= 0) {
		return 0;
	}
	return Math.ceil(slideCount / slidesPerPage);
}

/**
 * Estimate the printed page count for the full settings object: slides and
 * notes are one page each; outline is a single page; handouts paginate.
 */
export function estimatePageCount(
	printWhat: PrintWhat,
	slideCount: number,
	slidesPerPage: HandoutSlidesPerPage,
): number {
	if (printWhat === 'slides' || printWhat === 'notes') {
		return slideCount;
	}
	if (printWhat === 'outline') {
		return slideCount > 0 ? 1 : 0;
	}
	return computePrintPageCount(slideCount, slidesPerPage);
}

/* ------------------------------------------------------------------ */
/*  HTML escaping                                                      */
/* ------------------------------------------------------------------ */

/**
 * Escape text for safe interpolation into HTML element content / attributes.
 * Escapes `&`, `<`, `>`, `"`, and `'`. Uses `.split().join()` rather than
 * `replaceAll` to stay within the ng-packagr lib target.
 */
export function escapeHtml(value: string): string {
	return value
		.split('&')
		.join('&amp;')
		.split('<')
		.join('&lt;')
		.split('>')
		.join('&gt;')
		.split('"')
		.join('&quot;')
		.split("'")
		.join('&#39;');
}

/**
 * Validate an `img` `src` for inclusion in the print document. Only
 * `data:image/...` URLs pass through (escaped); anything else collapses to a
 * transparent 1x1 PNG so the markup stays well-formed and inert.
 */
export function safeDataImageSrc(src: string): string {
	if (typeof src !== 'string' || !src.startsWith('data:image/')) {
		return TRANSPARENT_PNG;
	}
	return escapeHtml(src);
}

/* ------------------------------------------------------------------ */
/*  Slide-title extraction (outline mode)                              */
/* ------------------------------------------------------------------ */

/**
 * Best-effort slide title: the first element carrying non-empty `text`,
 * falling back to `Slide N` (1-based).
 */
export function slideTitle(slide: PptxSlide | undefined, index: number): string {
	const fallback = `Slide ${index + 1}`;
	if (!slide) {
		return fallback;
	}
	const elements = slide.elements ?? [];
	for (const el of elements) {
		if ('text' in el) {
			const text = (el as { text?: unknown }).text;
			if (typeof text === 'string' && text.trim()) {
				return text;
			}
		}
	}
	return fallback;
}

/* ------------------------------------------------------------------ */
/*  Markup builders                                                    */
/* ------------------------------------------------------------------ */

/** Build the outline body markup (`<h2>` title + optional `<p>` notes per slide). */
export function buildOutlineHtml(slideIndices: number[], slides: PptxSlide[]): string {
	return slideIndices
		.map((idx) => {
			const slide = slides[idx];
			if (!slide) {
				return '';
			}
			const titleText = slideTitle(slide, idx);
			const notes = (slide.notes ?? '').trim();
			return `<h2>${escapeHtml(titleText)}</h2>${notes ? `<p>${escapeHtml(notes)}</p>` : ''}`;
		})
		.join('');
}

/** Build the body markup for full-page slide printing (one `<section>` each). */
export function buildSlidesHtml(slideImages: string[], slideIndices: number[]): string {
	return slideImages
		.map(
			(img, i) =>
				`<section class="page slide-page"><img class="slide-img" src="${safeDataImageSrc(img)}" alt="Slide ${(slideIndices[i] ?? i) + 1}" /></section>`,
		)
		.join('');
}

/** Build the body markup for notes-page printing (slide thumbnail + notes). */
export function buildNotesHtml(
	slideImages: string[],
	slideIndices: number[],
	slides: PptxSlide[],
): string {
	return slideImages
		.map((img, i) => {
			const idx = slideIndices[i] ?? i;
			const notes = (slides[idx]?.notes ?? '').trim();
			return `<section class="page notes-page">
  <img class="notes-slide" src="${safeDataImageSrc(img)}" alt="Slide ${idx + 1}" />
  <div class="notes-text">${escapeHtml(notes)}</div>
</section>`;
		})
		.join('');
}

/** Build the ruled note-line markup used next to slides in 3-per-page handouts. */
function buildNoteLines(): string {
	const count = NOTE_LINE_COUNT;
	const lines = Array.from(
		{ length: count },
		(_, i) =>
			`<div class="handout-note-line" style="top: ${((i + 1) / (count + 1)) * 100}%"></div>`,
	).join('');
	return `<div class="handout-note-lines">${lines}</div>`;
}

/**
 * Build the body markup for handout printing. The grid is derived from
 * `slidesPerPage`; the 3-per-page layout adds ruled note lines on the right.
 */
export function buildHandoutsHtml(
	slideImages: string[],
	slideIndices: number[],
	slidesPerPage: HandoutSlidesPerPage,
): string {
	const grid = getHandoutGrid(slidesPerPage);
	const isThreePerPage = slidesPerPage === 3;
	const pages: string[] = [];

	for (let i = 0; i < slideImages.length; i += slidesPerPage) {
		const pageImgs = slideImages.slice(i, i + slidesPerPage);
		if (isThreePerPage) {
			const rows = Array.from({ length: slidesPerPage }, (_, cellIndex) => {
				const img = pageImgs[cellIndex];
				const slideCell = img
					? `<div class="handout-cell"><img src="${safeDataImageSrc(img)}" alt="Slide ${(slideIndices[i + cellIndex] ?? i + cellIndex) + 1}" /></div>`
					: `<div class="handout-cell"></div>`;
				return `<div class="handout-row-3">${slideCell}${buildNoteLines()}</div>`;
			}).join('');
			pages.push(`<section class="page"><div class="handout-grid-3">${rows}</div></section>`);
		} else {
			const cells = Array.from({ length: slidesPerPage }, (_, cellIndex) => {
				const img = pageImgs[cellIndex];
				return img
					? `<div class="handout-cell"><img src="${safeDataImageSrc(img)}" alt="Slide ${(slideIndices[i + cellIndex] ?? i + cellIndex) + 1}" /></div>`
					: `<div class="handout-cell"></div>`;
			}).join('');
			pages.push(
				`<section class="page"><div class="handout-grid" style="grid-template-columns: repeat(${grid.columns}, minmax(0, 1fr)); grid-template-rows: repeat(${grid.rows}, minmax(0, 1fr));">${cells}</div></section>`,
			);
		}
	}

	return pages.join('');
}

/* ------------------------------------------------------------------ */
/*  Full document builder                                              */
/* ------------------------------------------------------------------ */

/** Options for {@link buildPrintHtmlDocument}. */
export interface PrintHtmlDocumentOptions {
	title: string;
	bodyHtml: string;
	orientation: PrintOrientation;
	colorFilter: string;
	frameSlides: boolean;
}

/**
 * `orientation` is typed as a union at compile time, but `buildPrintHtmlDocument`
 * is a public export reachable from plain JS callers, so a runtime check keeps
 * the value that reaches `@page` / `<style>` interpolation confined to those
 * two known-safe strings.
 */
function sanitizeOrientation(value: PrintOrientation): PrintOrientation {
	return value === 'portrait' ? 'portrait' : 'landscape';
}

/** Element/attribute shapes that must never appear in assembled print-window body HTML. */
const UNSAFE_BODY_HTML_SUBSTRINGS = [
	'<script',
	'<iframe',
	'<embed',
	'<object',
	'<foreignobject',
	// eslint-disable-next-line no-script-url -- security deny-list entry: verifies the scheme is rejected, never executed.
	'javascript:',
];

/** Matches an `on<event>=` handler attribute, e.g. `onload=`, `onclick=`. */
const EVENT_HANDLER_ATTR_RE = /\son\w+\s*=/iu;

/**
 * Defense-in-depth guard for the assembled print-window body HTML. Every
 * dynamic value the `build*Html` helpers above embed (titles, notes, image
 * `src`) is already escaped via {@link escapeHtml} / {@link safeDataImageSrc}
 * before it's spliced into `bodyHtml`; this additionally screens the
 * assembled fragment for script-injection shapes, so a future caller that
 * forgets to escape a new field doesn't reach the printed window unnoticed.
 */
function isSafePrintBodyHtml(html: string): boolean {
	const lower = html.toLowerCase();
	if (UNSAFE_BODY_HTML_SUBSTRINGS.some((needle) => lower.includes(needle))) {
		return false;
	}
	return !EVENT_HANDLER_ATTR_RE.test(html);
}

/** DOMPurify config for the assembled print-window body: plain HTML, no MathML/SVG needed. */
const PRINT_BODY_SANITIZE_CONFIG = { USE_PROFILES: { html: true } };

/**
 * Assemble the complete printable HTML document string (doctype + head with
 * print CSS + body). Pure: the caller writes it into a print window.
 */
export function buildPrintHtmlDocument(options: PrintHtmlDocumentOptions): string {
	const { title, bodyHtml, frameSlides } = options;
	const orientation = sanitizeOrientation(options.orientation);
	const colorFilter = options.colorFilter;
	// Belt-and-suspenders: the deny-list guard runs first, then DOMPurify
	// actually transforms the markup (stripping `<script>`/`<iframe>`/event
	// handlers/`javascript:` URIs) before it is spliced in, rather than
	// merely gating the raw, untransformed string behind a boolean check.
	const safeBodyHtml = isSafePrintBodyHtml(bodyHtml)
		? sanitizeMarkupOrEmpty(bodyHtml, PRINT_BODY_SANITIZE_CONFIG)
		: '';
	const frameStyle = frameSlides
		? 'img.slide-img, .notes-slide, .handout-cell img { border: 2px solid #000 !important; }'
		: '';

	return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #ffffff; color: #111827; font: 12px/1.4 "Segoe UI", Arial, sans-serif; ${colorFilter} }
      .page { page-break-after: always; padding: 10mm; width: 100%; }
      .page:last-child { page-break-after: auto; }
      .slide-page { display: flex; align-items: center; justify-content: center; min-height: 250mm; }
      .slide-page img.slide-img { max-width: 100%; max-height: 240mm; border-radius: 4px; }
      .notes-page { display: grid; grid-template-rows: auto 1fr; gap: 4mm; min-height: 250mm; }
      .notes-slide { width: 100%; border: 1px solid #d1d5db; border-radius: 4px; }
      .notes-text { border: 1px solid #d1d5db; border-radius: 4px; padding: 3mm; white-space: pre-wrap; }
      .handout-grid { display: grid; gap: 3mm; width: 100%; height: 250mm; }
      .handout-cell { border: 1px solid #d1d5db; border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #ffffff; }
      .handout-cell img { width: 100%; height: 100%; object-fit: contain; display: block; }
      .handout-grid-3 { display: flex; flex-direction: column; gap: 4mm; width: 100%; height: 250mm; }
      .handout-row-3 { display: flex; gap: 4mm; flex: 1; }
      .handout-row-3 .handout-cell { flex: 0 0 45%; }
      .handout-note-lines { flex: 1; position: relative; border-left: 1px solid #d1d5db; padding-left: 3mm; }
      .handout-note-line { position: absolute; left: 3mm; right: 0; height: 0; border-bottom: 1px solid #d1d5db; }
      .outline-page { padding: 10mm; }
      .outline-page h2 { font-size: 14px; margin: 12px 0 4px; color: #374151; }
      .outline-page p { font-size: 12px; margin: 2px 0 2px 16px; color: #4b5563; }
      @page { size: ${orientation}; margin: 8mm; }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        img { break-inside: avoid; }
      }
      ${frameStyle}
    </style>
  </head>
  <body>${safeBodyHtml}</body>
</html>`;
}
