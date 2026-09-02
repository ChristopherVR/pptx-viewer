/**
 * HTML markup for a resolved `HandoutMasterChrome` (see `handout-master-chrome.ts`):
 * the background paint, the header/footer/date/page-number boxes, and (when
 * the master supplies them) absolutely-positioned slide cells. Split out of
 * `print-document.ts` (already over this repo's 300-LOC-per-file guideline)
 * so `buildHandoutsHtml` there stays a thin per-page loop.
 *
 * All rects are page fractions (`0..1`); painted as percentages against a
 * `.handout-chrome-frame` wrapper the caller sizes to the printable page.
 */
import type { MasterPageRect } from '../render/master-page-layout';
import type { HandoutMasterChrome } from './handout-master-chrome';
import { escapeHtml, safeDataImageSrc } from './html-escape';

/** Inline `style` background declarations for a chrome-bearing `.page` section. */
export function handoutBackgroundStyle(chrome: HandoutMasterChrome): string {
	const bg = chrome.background;
	if (!bg) {
		return '';
	}
	const declarations: string[] = [];
	if (bg.color) {
		declarations.push(`background-color: ${escapeHtml(bg.color)};`);
	}
	if (bg.imageDataUrl) {
		declarations.push(
			`background-image: url(${safeDataImageSrc(bg.imageDataUrl)}); background-size: cover; background-position: center;`,
		);
	}
	return declarations.join(' ');
}

/** One absolutely-positioned percentage box (header/footer/date/page-number/slide cell). */
function positionedBoxStyle(rect: MasterPageRect): string {
	return (
		`left: ${(rect.x * 100).toFixed(3)}%; top: ${(rect.y * 100).toFixed(3)}%; ` +
		`width: ${(rect.w * 100).toFixed(3)}%; height: ${(rect.h * 100).toFixed(3)}%;`
	);
}

/** Markup for the header/footer/date/page-number text boxes, empty string when none apply. */
export function handoutChromeBoxesHtml(chrome: HandoutMasterChrome): string {
	const boxes: string[] = [];
	if (chrome.header) {
		boxes.push(
			`<div class="handout-chrome-box handout-chrome-box--header" style="${positionedBoxStyle(chrome.header.rect)}">${escapeHtml(chrome.header.text)}</div>`,
		);
	}
	if (chrome.footer) {
		boxes.push(
			`<div class="handout-chrome-box handout-chrome-box--footer" style="${positionedBoxStyle(chrome.footer.rect)}">${escapeHtml(chrome.footer.text)}</div>`,
		);
	}
	if (chrome.date) {
		boxes.push(
			`<div class="handout-chrome-box handout-chrome-box--date" style="${positionedBoxStyle(chrome.date.rect)}">${escapeHtml(chrome.date.text)}</div>`,
		);
	}
	if (chrome.pageNumber) {
		boxes.push(
			`<div class="handout-chrome-box handout-chrome-box--page-number" style="${positionedBoxStyle(chrome.pageNumber.rect)}">${escapeHtml(chrome.pageNumber.text)}</div>`,
		);
	}
	return boxes.join('');
}

/**
 * Slide cells positioned from the master's own placeholder rects rather than
 * the app-computed CSS grid. Only called when `chrome.slideRects` is set
 * (the master authored positioned slide-image placeholders).
 */
export function handoutSlideRectCellsHtml(
	pageImages: (string | undefined)[],
	slideRects: MasterPageRect[],
	slideIndices: number[],
	pageStartIndex: number,
): string {
	return slideRects
		.map((rect, cellIndex) => {
			const img = pageImages[cellIndex];
			const style = positionedBoxStyle(rect);
			const inner = img
				? `<img src="${safeDataImageSrc(img)}" alt="Slide ${(slideIndices[pageStartIndex + cellIndex] ?? pageStartIndex + cellIndex) + 1}" />`
				: '';
			return `<div class="handout-cell handout-cell--positioned" style="${style}">${inner}</div>`;
		})
		.join('');
}

/**
 * Whether the resolved chrome has anything at all to paint (background,
 * any text box, or custom slide rects). When `false`, the caller should skip
 * the chrome wrapper entirely and render the plain existing markup, keeping
 * output byte-identical for callers that don't pass a handout master.
 */
export function hasHandoutChrome(chrome: HandoutMasterChrome): boolean {
	return Boolean(
		chrome.background || chrome.header || chrome.footer || chrome.date || chrome.pageNumber,
	);
}
