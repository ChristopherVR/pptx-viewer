import type { OleSheetGrid } from './ole-sheet-xlsx-editor';
/**
 * Regenerate the inline (non-icon) preview PowerPoint shows for an embedded
 * OLE object after its content has been edited in the viewer, so the
 * `p:pic` blip stops showing stale data once the deck is saved.
 *
 * This intentionally does not attempt pixel-parity with the source
 * application's own rendering (a full Excel/Word/PowerPoint layout engine is
 * out of scope for a preview thumbnail); it renders a faithful, DOM-free
 * summary of the actual edited data: the sheet grid's text and borders, the
 * document's paragraph text, or the nested deck's first slide's text
 * content. The important property is that it is never stale: whatever is in
 * the payload after an edit is what gets rasterised.
 *
 * @module ole-content-preview-raster
 */
import { encodePng } from './png-encoder';
import { RasterCanvas, rgb } from './raster-canvas';

const BORDER = rgb(0xc0, 0xc0, 0xc0);
const TEXT = rgb(0x20, 0x20, 0x20);
const BACKGROUND = rgb(255, 255, 255);
const HEADER_BG = rgb(0xf0, 0xf0, 0xf0);

const PREVIEW_WIDTH = 320;
const PREVIEW_HEIGHT = 200;
const MAX_ROWS = 8;
const MAX_COLS = 6;

/** Render a spreadsheet grid preview (rows/columns of cell text) as a PNG. */
export function renderOleSheetPreviewPng(grid: OleSheetGrid): Uint8Array {
	const canvas = new RasterCanvas(PREVIEW_WIDTH, PREVIEW_HEIGHT, BACKGROUND);
	const rows = Math.min(grid.rows.length, MAX_ROWS) || 1;
	const cols = Math.min(
		grid.rows.reduce((max, row) => Math.max(max, row.cells.length), 1),
		MAX_COLS,
	);
	const cellW = PREVIEW_WIDTH / cols;
	const cellH = PREVIEW_HEIGHT / rows;
	const scale = 1;

	for (let r = 0; r < rows; r++) {
		const row = grid.rows[r];
		for (let c = 0; c < cols; c++) {
			const x = c * cellW;
			const y = r * cellH;
			if (r === 0) {
				canvas.fillRect(x, y, cellW, cellH, HEADER_BG);
			}
			canvas.strokeRect(x, y, cellW, cellH, BORDER, 1);
			const value = row?.cells[c]?.value;
			if (value !== undefined && value !== '') {
				const text = RasterCanvas.truncateToWidth(String(value), cellW - 6, scale);
				canvas.drawText(text, x + 3, y + (cellH - 7) / 2, TEXT, scale);
			}
		}
	}
	return encodePng(canvas.width, canvas.height, canvas.pixels);
}

/** Render a word-processing document preview (wrapped paragraph text) as a PNG. */
export function renderOleDocumentPreviewPng(paragraphs: readonly string[]): Uint8Array {
	const canvas = new RasterCanvas(PREVIEW_WIDTH, PREVIEW_HEIGHT, BACKGROUND);
	const scale = 1;
	const lineHeight = 10;
	const maxCharsPerLine = Math.floor((PREVIEW_WIDTH - 16) / (6 * scale));
	let y = 10;
	for (const paragraph of paragraphs) {
		if (y > PREVIEW_HEIGHT - lineHeight) {
			break;
		}
		const words = paragraph.split(/\s+/u).filter((w) => w.length > 0);
		let line = '';
		for (const word of words) {
			const candidate = line.length > 0 ? `${line} ${word}` : word;
			if (candidate.length > maxCharsPerLine) {
				if (line.length > 0) {
					canvas.drawText(line, 8, y, TEXT, scale);
					y += lineHeight;
					if (y > PREVIEW_HEIGHT - lineHeight) {
						break;
					}
				}
				line = word;
			} else {
				line = candidate;
			}
		}
		if (line.length > 0 && y <= PREVIEW_HEIGHT - lineHeight) {
			canvas.drawText(line, 8, y, TEXT, scale);
			y += lineHeight;
		}
		y += 4; // paragraph spacing
	}
	return encodePng(canvas.width, canvas.height, canvas.pixels);
}

/**
 * Render a simplified preview of a nested PPTX deck's first slide: its
 * title and body text lines, stacked top to bottom. Not a visual replica of
 * the slide's real layout/design (that would require the full renderer,
 * which lives in each viewer binding, not core) -- just enough to show that
 * the preview reflects the edited deck's actual current text content.
 */
export function renderOleDeckPreviewPng(firstSlideTextLines: readonly string[]): Uint8Array {
	return renderOleDocumentPreviewPng(firstSlideTextLines);
}
