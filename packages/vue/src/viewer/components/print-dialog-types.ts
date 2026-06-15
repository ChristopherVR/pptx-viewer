/**
 * Shared types, interfaces, and pure logic for the PrintDialog family (Vue).
 *
 * Vue port of the React `print-dialog-types.ts`. The DOM-free range / page /
 * preview-index math lives here so it can be unit-tested without mounting a
 * component (mirrors the React tests in `print-dialog-types.test.ts` and the
 * pure helpers extracted in `usePrintHandlers.test.ts`).
 */
import type { PptxSlide } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HANDOUT_OPTIONS: readonly HandoutSlidesPerPage[] = [1, 2, 3, 4, 6, 9];

/** Grid (rows × columns) per slides-per-page value; fallback is 3 × 2. */
const HANDOUT_GRID_MAP: Record<number, HandoutGrid> = {
	1: { rows: 1, columns: 1 },
	2: { rows: 2, columns: 1 },
	3: { rows: 3, columns: 1 },
	4: { rows: 2, columns: 2 },
	6: { rows: 3, columns: 2 },
	9: { rows: 3, columns: 3 },
};

// ---------------------------------------------------------------------------
// Pure logic — range / page / preview math
// ---------------------------------------------------------------------------

/** Type guard: is the given number one of the supported slides-per-page values? */
export function isHandoutSlidesPerPage(value: number): value is HandoutSlidesPerPage {
	return (HANDOUT_OPTIONS as readonly number[]).includes(value);
}

/**
 * Resolve a default slides-per-page (e.g. from presentation properties) to a
 * supported value, falling back to 6 when unset or unsupported.
 */
export function resolveSlidesPerPage(defaultSlidesPerPage?: number): HandoutSlidesPerPage {
	return defaultSlidesPerPage !== undefined && isHandoutSlidesPerPage(defaultSlidesPerPage)
		? defaultSlidesPerPage
		: 6;
}

/**
 * Compute the zero-based slide indices to print for the given range settings.
 * 1-based `customRangeFrom` / `customRangeTo` are clamped to valid bounds.
 *
 * Mirrors the index computation in the React `usePrintHandlers`.
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
 * Effective orientation: notes/outline/handouts are always portrait; only
 * full-page slides honour the user-chosen orientation.
 */
export function effectiveOrientation(
	printWhat: PrintWhat,
	orientation: PrintOrientation,
): PrintOrientation {
	if (printWhat === 'notes' || printWhat === 'outline' || printWhat === 'handouts') {
		return 'portrait';
	}
	return orientation;
}

/** Number of slides selected by the given range. */
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

/** Number of printed pages for the selected layout. */
export function computePageCount(
	printWhat: PrintWhat,
	slideCount: number,
	slidesPerPage: HandoutSlidesPerPage,
): number {
	if (printWhat === 'slides' || printWhat === 'notes') {
		return slideCount;
	}
	if (printWhat === 'outline') {
		return 1;
	}
	return Math.ceil(slideCount / slidesPerPage);
}

/** Grid dimensions for the given slides-per-page value (fallback 3 × 2). */
export function getHandoutGrid(slidesPerPage: number): HandoutGrid {
	return HANDOUT_GRID_MAP[slidesPerPage] ?? { rows: 3, columns: 2 };
}

/** CSS `filter` declaration for the chosen colour mode (empty for `color`). */
export function computeColorFilter(colorMode: PrintColorMode): string {
	if (colorMode === 'grayscale') {
		return 'filter: grayscale(1);';
	}
	if (colorMode === 'blackAndWhite') {
		return 'filter: grayscale(1) contrast(2);';
	}
	return '';
}

/**
 * Escape a value for safe interpolation into print HTML (text or attribute).
 * Escapes `&`, `<`, `>`, `"`, and `'`. Ported from React `dom-helpers.escapeHtml`.
 */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/gu, '&amp;')
		.replace(/</gu, '&lt;')
		.replace(/>/gu, '&gt;')
		.replace(/"/gu, '&quot;')
		.replace(/'/gu, '&#39;');
}

/**
 * Build the outline-mode HTML body: a `<h2>` per slide title (first text element,
 * falling back to `Slide N`) plus a `<p>` of notes when present. All interpolated
 * text is HTML-escaped.
 */
export function buildOutlineHtml(slideIndices: number[], slides: PptxSlide[]): string {
	return slideIndices
		.map((idx) => {
			const slide = slides[idx];
			if (!slide) {
				return '';
			}
			const title = slide.elements?.find((el) => 'text' in el && (el as { text?: unknown }).text);
			const titleText =
				title && 'text' in title ? String((title as { text?: unknown }).text) : `Slide ${idx + 1}`;
			const notes = slide.notes?.trim() ?? '';
			return `<h2>${escapeHtml(titleText)}</h2>${notes ? `<p>${escapeHtml(notes)}</p>` : ''}`;
		})
		.join('');
}

/**
 * Validate an `<img>` `src` for inclusion in print-window HTML. Only
 * `data:image/...` URLs pass; anything else returns a transparent 1×1 PNG
 * sentinel so the document stays well-formed and nothing exploitable is emitted.
 */
export function safeDataImageSrc(src: string): string {
	if (typeof src !== 'string' || !src.startsWith('data:image/')) {
		return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
	}
	return escapeHtml(src);
}
