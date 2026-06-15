/**
 * Pure print helper utilities — no Angular, no DOM side effects, no
 * `window.print()`. Everything here is deterministic and unit-testable in
 * isolation (vitest + happy-dom, no TestBed).
 *
 * Mirrors the React print subsystem:
 *   - `print-dialog-types.ts`        → print settings types / defaults / constants
 *   - `usePrintHandlers.ts`          → slide-index, colour-filter, outline + handout markup
 *   - `handout-layout-utils.ts`      → A4 page-layout / slides-per-page grid maths
 *
 * The {@link PrintService} consumes these helpers and applies the DOM /
 * print-window side effects.
 *
 * ng-packagr constraints honoured here:
 *   - NO `String.prototype.replaceAll` (use `.split(x).join(y)`).
 *   - NO regex named-capture groups.
 *   - All regexes carry the `/u` flag.
 */

import type { PptxSlide } from 'pptx-viewer-core';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** What to print. */
export type PrintWhat = 'slides' | 'handouts' | 'notes' | 'outline';

/** Page orientation for the printed output. */
export type PrintOrientation = 'portrait' | 'landscape';

/** Colour mode for the printed output. */
export type PrintColorMode = 'color' | 'grayscale' | 'blackAndWhite';

/** Handout slides-per-page options. */
export type HandoutSlidesPerPage = 1 | 2 | 3 | 4 | 6 | 9;

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

/** Grid dimensions for a handout layout. */
export interface HandoutGrid {
	rows: number;
	columns: number;
}

/** A4 page dimensions in mm. */
export interface PageDimensions {
	width: number;
	height: number;
	marginTop: number;
	marginRight: number;
	marginBottom: number;
	marginLeft: number;
}

/** Computed cell position within a handout page. */
export interface HandoutCellPosition {
	/** Zero-based index of the slide in the source array (or -1 for empty). */
	slideIndex: number;
	/** Row in the grid (0-based). */
	row: number;
	/** Column in the grid (0-based). */
	col: number;
	/** X offset in mm from the printable area left edge. */
	x: number;
	/** Y offset in mm from the printable area top edge. */
	y: number;
	/** Width of the cell in mm. */
	width: number;
	/** Height of the cell in mm. */
	height: number;
}

/** A single page of a handout layout. */
export interface HandoutPage {
	pageIndex: number;
	cells: HandoutCellPosition[];
	/** Whether this layout includes note lines (3-per-page). */
	hasNoteLines: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Available slides-per-page options for handouts. */
export const HANDOUT_OPTIONS: HandoutSlidesPerPage[] = [1, 2, 3, 4, 6, 9];

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

/** Standard A4 portrait dimensions in mm. */
export const A4_PORTRAIT: PageDimensions = {
	width: 210,
	height: 297,
	marginTop: 12,
	marginRight: 12,
	marginBottom: 12,
	marginLeft: 12,
};

/** Standard A4 landscape dimensions in mm. */
export const A4_LANDSCAPE: PageDimensions = {
	width: 297,
	height: 210,
	marginTop: 12,
	marginRight: 12,
	marginBottom: 12,
	marginLeft: 12,
};

/** Gap between cells in mm. */
const CELL_GAP = 4;

/** Width fraction for the slide column in 3-per-page layout (rest is note lines). */
const THREE_PER_PAGE_SLIDE_FRACTION = 0.45;

/** Number of ruled note lines drawn next to each slide in 3-per-page handouts. */
const NOTE_LINE_COUNT = 8;

const GRID_MAP: Record<number, HandoutGrid> = {
	1: { rows: 1, columns: 1 },
	2: { rows: 2, columns: 1 },
	3: { rows: 3, columns: 1 },
	4: { rows: 2, columns: 2 },
	6: { rows: 3, columns: 2 },
	9: { rows: 3, columns: 3 },
};

/** Transparent 1×1 PNG used as a safe fallback for non-data image sources. */
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
 * orientation (matching the React dialog's `effectiveOrientation`).
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

	// Clamp the custom range into valid 1-based bounds.
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
export function computePageCount(slideCount: number, slidesPerPage: HandoutSlidesPerPage): number {
	if (slideCount <= 0) {
		return 0;
	}
	return Math.ceil(slideCount / slidesPerPage);
}

/**
 * Estimate the printed page count for the full settings object — slides and
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
	return computePageCount(slideCount, slidesPerPage);
}

/* ------------------------------------------------------------------ */
/*  Handout grid / layout maths                                        */
/* ------------------------------------------------------------------ */

/** Grid dimensions for a slides-per-page value (fallback 3×2). */
export function getHandoutGrid(slidesPerPage: number): HandoutGrid {
	return GRID_MAP[slidesPerPage] ?? { rows: 3, columns: 2 };
}

/** The note-line count used in 3-per-page handout layouts. */
export function generateNoteLineCount(): number {
	return NOTE_LINE_COUNT;
}

/** Printable area (page minus margins) in mm for the given orientation. */
export function getPrintableArea(orientation: PrintOrientation = 'portrait'): {
	width: number;
	height: number;
} {
	const page = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
	return {
		width: page.width - page.marginLeft - page.marginRight,
		height: page.height - page.marginTop - page.marginBottom,
	};
}

/**
 * Compute the cell positions for a single handout page. For 3-per-page the
 * slides occupy a narrow left column (note lines fill the rest).
 */
export function computePageCells(
	pageIndex: number,
	slidesPerPage: HandoutSlidesPerPage,
	totalSlides: number,
	startSlideIndex: number,
	page: PageDimensions = A4_PORTRAIT,
): HandoutPage {
	const grid = getHandoutGrid(slidesPerPage);
	const printableWidth = page.width - page.marginLeft - page.marginRight;
	const printableHeight = page.height - page.marginTop - page.marginBottom;
	const isThreePerPage = slidesPerPage === 3;

	const cells: HandoutCellPosition[] = [];

	if (isThreePerPage) {
		const slideAreaWidth = printableWidth * THREE_PER_PAGE_SLIDE_FRACTION;
		const cellHeight = (printableHeight - CELL_GAP * (grid.rows - 1)) / grid.rows;

		for (let row = 0; row < grid.rows; row++) {
			const slideIdx = startSlideIndex + row;
			cells.push({
				slideIndex: slideIdx < totalSlides ? slideIdx : -1,
				row,
				col: 0,
				x: 0,
				y: row * (cellHeight + CELL_GAP),
				width: slideAreaWidth,
				height: cellHeight,
			});
		}
	} else {
		const cellWidth = (printableWidth - CELL_GAP * (grid.columns - 1)) / grid.columns;
		const cellHeight = (printableHeight - CELL_GAP * (grid.rows - 1)) / grid.rows;

		let cellIndex = 0;
		for (let row = 0; row < grid.rows; row++) {
			for (let col = 0; col < grid.columns; col++) {
				const slideIdx = startSlideIndex + cellIndex;
				cells.push({
					slideIndex: slideIdx < totalSlides ? slideIdx : -1,
					row,
					col,
					x: col * (cellWidth + CELL_GAP),
					y: row * (cellHeight + CELL_GAP),
					width: cellWidth,
					height: cellHeight,
				});
				cellIndex++;
			}
		}
	}

	return { pageIndex, cells, hasNoteLines: isThreePerPage };
}

/**
 * Compute the complete handout layout: all pages with positioned cells,
 * remapped to the actual source slide indices.
 */
export function computeHandoutLayout(
	slideIndices: number[],
	slidesPerPage: HandoutSlidesPerPage,
	orientation: PrintOrientation = 'portrait',
): HandoutPage[] {
	const totalSlides = slideIndices.length;
	if (totalSlides === 0) {
		return [];
	}

	const pageDimensions = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
	const pageCount = computePageCount(totalSlides, slidesPerPage);
	const pages: HandoutPage[] = [];

	for (let p = 0; p < pageCount; p++) {
		const startSlideIndex = p * slidesPerPage;
		const page = computePageCells(p, slidesPerPage, totalSlides, startSlideIndex, pageDimensions);
		const remappedCells = page.cells.map((cell) => ({
			...cell,
			slideIndex:
				cell.slideIndex >= 0 && cell.slideIndex < totalSlides ? slideIndices[cell.slideIndex] : -1,
		}));
		pages.push({ ...page, cells: remappedCells });
	}

	return pages;
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
 * transparent 1×1 PNG so the markup stays well-formed and inert.
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

/** Build the `<div class="outline-page">…</div>` body for outline printing. */
export function buildOutlineHtml(slideIndices: number[], slides: PptxSlide[]): string {
	const inner = slideIndices
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
	return inner;
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
	const count = generateNoteLineCount();
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

/** Options for {@link buildPrintDocument}. */
export interface PrintDocumentOptions {
	title: string;
	bodyHtml: string;
	orientation: PrintOrientation;
	colorFilter: string;
	frameSlides: boolean;
}

/**
 * Assemble the complete printable HTML document string (doctype + head with
 * print CSS + body). Pure: the caller writes it into a print window.
 */
export function buildPrintDocument(options: PrintDocumentOptions): string {
	const { title, bodyHtml, orientation, colorFilter, frameSlides } = options;
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
  <body>${bodyHtml}</body>
</html>`;
}
