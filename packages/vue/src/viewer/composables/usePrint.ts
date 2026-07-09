import type { PptxSlide } from 'pptx-viewer-core';
import { ref } from 'vue';
import type { Ref } from 'vue';

import {
	buildOutlineHtml,
	computeColorFilter,
	computeSlideIndices,
	escapeHtml,
	getHandoutGrid,
	safeDataImageSrc,
} from '../components/print-dialog-types';
import type { PrintSettings } from '../components/print-dialog-types';

/**
 * usePrint: print-dialog state + the print-with-settings flow for the Vue
 * viewer. Vue port of the React `usePrintHandlers` (raster path).
 *
 * The DOM-touching pieces are injected so the composable is unit-testable with
 * mocks, exactly like `useExport` injects `rasterizeSlide`:
 *  - `rasterizeSlide(index)` rasterises one slide to a canvas (the host owns the
 *    off-screen `SlideStage` + `html2canvas-pro` integration).
 *  - `openPrintWindow(html)` opens a print window for a full HTML document. A
 *    default implementation (`window.open` → write → print) is supplied.
 *
 * The SVG vector print path from React is intentionally omitted (Vue has no SVG
 * slide serializer yet); the raster path covers slides / notes / handouts /
 * outline. Slide titles for outline mode reuse the shared `buildOutlineHtml`.
 */

/** Rasterise the slide at `index` to a canvas. Host-supplied (DOM-coupled). */
export type RasterizeSlide = (index: number) => Promise<HTMLCanvasElement>;

/**
 * Open a print window for a complete HTML document and trigger printing.
 * Returns `false` if the window was blocked (e.g. popup blocker).
 */
export type OpenPrintWindow = (htmlDocument: string) => boolean;

export interface UsePrintOptions {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	rasterizeSlide: RasterizeSlide;
	/** Override the print-window opener (defaults to a `window.open` impl). */
	openPrintWindow?: OpenPrintWindow;
}

export interface UsePrintResult {
	/** Whether the print dialog is open. */
	isPrintDialogOpen: Ref<boolean>;
	/** Open the print dialog (the toolbar print button). */
	openPrintDialog: () => void;
	/** Close the print dialog without printing. */
	closePrintDialog: () => void;
	/** Run the print flow for the confirmed settings (closes the dialog first). */
	print: (settings: PrintSettings) => Promise<void>;
}

/** Default print-window opener: writes a full HTML doc and calls `print()`. */
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
 * `orientation` is typed as a union at compile time, but `buildPrintDocument`
 * is reachable from plain JS callers, so a runtime check keeps the value
 * that reaches `@page` / `<style>` interpolation confined to those two
 * known-safe strings.
 */
function sanitizeOrientation(value: 'landscape' | 'portrait'): 'landscape' | 'portrait' {
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
 * dynamic value the callers below embed (titles, notes, image `src`) is
 * already escaped via {@link escapeHtml} / {@link safeDataImageSrc} before
 * it's spliced into `bodyHtml`; this additionally screens the assembled
 * fragment for script-injection shapes, so a future caller that forgets to
 * escape a new field doesn't reach the printed window unnoticed.
 */
function isSafePrintBodyHtml(html: string): boolean {
	const lower = html.toLowerCase();
	if (UNSAFE_BODY_HTML_SUBSTRINGS.some((needle) => lower.includes(needle))) {
		return false;
	}
	return !EVENT_HANDLER_ATTR_RE.test(html);
}

/** Assemble the print stylesheet + body into a complete HTML document. */
function buildPrintDocument(
	title: string,
	bodyHtml: string,
	orientation: 'landscape' | 'portrait',
	colorFilter: string,
	frameSlides: boolean,
): string {
	const safeOrientation = sanitizeOrientation(orientation);
	const safeBodyHtml = isSafePrintBodyHtml(bodyHtml) ? bodyHtml : '';
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
      @page { size: ${safeOrientation}; margin: 8mm; }
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

export function usePrint(options: UsePrintOptions): UsePrintResult {
	const { slides, activeSlideIndex, rasterizeSlide } = options;
	const openWindow = options.openPrintWindow ?? defaultOpenPrintWindow;

	const isPrintDialogOpen = ref(false);

	function openPrintDialog(): void {
		isPrintDialogOpen.value = true;
	}

	function closePrintDialog(): void {
		isPrintDialogOpen.value = false;
	}

	async function print(settings: PrintSettings): Promise<void> {
		isPrintDialogOpen.value = false;

		const slideList = slides.value;
		const colorFilter = computeColorFilter(settings.colorMode);
		const slideIndices = computeSlideIndices(
			settings.slideRange,
			activeSlideIndex.value,
			slideList.length,
			settings.customRangeFrom,
			settings.customRangeTo,
		);

		// ── Outline: text-only, no rasterisation needed ─────────────────────
		if (settings.printWhat === 'outline') {
			const outlineHtml = buildOutlineHtml(slideIndices, slideList);
			openWindow(
				buildPrintDocument(
					'Outline',
					`<div class="outline-page">${outlineHtml}</div>`,
					settings.orientation,
					colorFilter,
					settings.frameSlides,
				),
			);
			return;
		}

		if (slideIndices.length === 0) {
			return;
		}

		try {
			// Rasterise each selected slide to a PNG data URL.
			const images: string[] = [];
			for (const idx of slideIndices) {
				const canvas = await rasterizeSlide(idx);
				images.push(canvas.toDataURL('image/png'));
			}

			if (settings.printWhat === 'slides') {
				const bodyHtml = images
					.map(
						(img, i) =>
							`<section class="page slide-page"><img class="slide-img" src="${safeDataImageSrc(img)}" alt="Slide ${slideIndices[i] + 1}" /></section>`,
					)
					.join('');
				openWindow(
					buildPrintDocument(
						'Slides',
						bodyHtml,
						settings.orientation,
						colorFilter,
						settings.frameSlides,
					),
				);
				return;
			}

			if (settings.printWhat === 'notes') {
				const notesPages = images
					.map((img, i) => {
						const idx = slideIndices[i];
						const notes = slideList[idx]?.notes?.trim() ?? '';
						return `<section class="page notes-page">
  <img class="notes-slide" src="${safeDataImageSrc(img)}" alt="Slide ${idx + 1}" />
  <div class="notes-text">${escapeHtml(notes)}</div>
</section>`;
					})
					.join('');
				openWindow(
					buildPrintDocument(
						'Notes Pages',
						notesPages,
						'portrait',
						colorFilter,
						settings.frameSlides,
					),
				);
				return;
			}

			// ── Handouts ─────────────────────────────────────────────────────
			const spp = settings.slidesPerPage;
			const grid = getHandoutGrid(spp);
			const isThreePerPage = spp === 3;
			const pages: string[] = [];
			const buildNoteLines = (): string => {
				const lines = Array.from(
					{ length: 8 },
					(_, i) => `<div class="handout-note-line" style="top: ${((i + 1) / 9) * 100}%"></div>`,
				).join('');
				return `<div class="handout-note-lines">${lines}</div>`;
			};
			for (let i = 0; i < images.length; i += spp) {
				const pageImgs = images.slice(i, i + spp);
				if (isThreePerPage) {
					const rows = Array.from({ length: spp }, (_, cellIndex) => {
						const img = pageImgs[cellIndex];
						const slideCell = img
							? `<div class="handout-cell"><img src="${safeDataImageSrc(img)}" alt="Slide ${slideIndices[i + cellIndex] + 1}" /></div>`
							: `<div class="handout-cell"></div>`;
						return `<div class="handout-row-3">${slideCell}${buildNoteLines()}</div>`;
					}).join('');
					pages.push(`<section class="page"><div class="handout-grid-3">${rows}</div></section>`);
				} else {
					const cells = Array.from({ length: spp }, (_, cellIndex) => {
						const img = pageImgs[cellIndex];
						return img
							? `<div class="handout-cell"><img src="${safeDataImageSrc(img)}" alt="Slide ${slideIndices[i + cellIndex] + 1}" /></div>`
							: `<div class="handout-cell"></div>`;
					}).join('');
					pages.push(
						`<section class="page"><div class="handout-grid" style="grid-template-columns: repeat(${grid.columns}, minmax(0, 1fr)); grid-template-rows: repeat(${grid.rows}, minmax(0, 1fr));">${cells}</div></section>`,
					);
				}
			}
			openWindow(
				buildPrintDocument(
					`Handout ${spp} per page`,
					pages.join(''),
					'portrait',
					colorFilter,
					settings.frameSlides,
				),
			);
		} catch (err) {
			console.error('[PowerPointViewer] Print layout failed:', err);
		}
	}

	return { isPrintDialogOpen, openPrintDialog, closePrintDialog, print };
}
