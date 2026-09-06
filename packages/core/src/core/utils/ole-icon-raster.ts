/**
 * Regenerate the PNG PowerPoint shows for a `showAsIcon` OLE object: a
 * type glyph (Excel grid, Word document, PDF, ...) with the object's name
 * captioned underneath, matching what PowerPoint itself bakes into the
 * `p:pic` blip when you rename an embedded object's icon.
 *
 * The viewer's live renderers (`packages/shared/src/render/ole-icon-primitives.ts`)
 * draw the same glyph set as SVG for on-screen display; this module is core's
 * own DOM-free rasteriser so a renamed / re-authored icon survives a save and
 * still shows the right caption when the file is reopened in real PowerPoint,
 * not just in this viewer. It intentionally does not import the shared SVG
 * module (core has no dependency on `pptx-viewer-shared`); the glyph set here
 * is a small, independent mirror of the same six shapes.
 *
 * @module ole-icon-raster
 */
import { encodePng } from './png-encoder';
import { RasterCanvas, rgb } from './raster-canvas';
import type { RasterColor } from './raster-canvas';

/** The six OLE application glyphs the placeholder icon can render. */
export type OleIconGlyph =
	| 'excel'
	| 'word'
	| 'powerpoint'
	| 'pdf'
	| 'visio'
	| 'mathtype'
	| 'unknown';

const GLYPH_COLORS: Record<OleIconGlyph, RasterColor> = {
	excel: rgb(0x21, 0x73, 0x46),
	word: rgb(0x2b, 0x57, 0x9a),
	powerpoint: rgb(0xd2, 0x47, 0x26),
	pdf: rgb(0xd4, 0x27, 0x2e),
	visio: rgb(0x39, 0x55, 0xa3),
	mathtype: rgb(0x7b, 0x2d, 0x8e),
	unknown: rgb(0x66, 0x66, 0x66),
};

const WHITE = rgb(255, 255, 255);
const CAPTION_COLOR = rgb(0x20, 0x20, 0x20);

/** Draw the glyph body inside a `size x size` box at `(ox, oy)`. */
function drawGlyph(
	canvas: RasterCanvas,
	glyph: OleIconGlyph,
	ox: number,
	oy: number,
	size: number,
): void {
	const color = GLYPH_COLORS[glyph];
	canvas.fillRect(ox, oy, size, size, color);
	const inset = size * 0.12;
	switch (glyph) {
		case 'excel': {
			for (let i = 1; i < 3; i++) {
				canvas.drawLine(ox, oy + (size * i) / 3, ox + size, oy + (size * i) / 3, WHITE, 1);
				canvas.drawLine(ox + (size * i) / 3, oy, ox + (size * i) / 3, oy + size, WHITE, 1);
			}
			break;
		}
		case 'word':
		case 'powerpoint': {
			for (let i = 1; i <= 3; i++) {
				canvas.drawLine(
					ox + inset,
					oy + (size * i) / 4.5,
					ox + size - inset,
					oy + (size * i) / 4.5,
					WHITE,
					1,
				);
			}
			break;
		}
		case 'pdf':
		case 'mathtype':
		case 'visio':
		case 'unknown':
		default: {
			canvas.strokeRect(ox + inset, oy + inset, size - inset * 2, size - inset * 2, WHITE, 1);
			break;
		}
	}
}

/** Options controlling the rasterised icon image. */
export interface OleIconRasterOptions {
	/** Overall image width in pixels (default 128). */
	width?: number;
	/** Overall image height in pixels (default 96). */
	height?: number;
	/** Which glyph to draw (default `'unknown'`). */
	glyph?: OleIconGlyph;
	/** Caption text drawn under the icon (typically the object name). */
	caption?: string;
}

/**
 * Render an OLE "show as icon" placeholder (glyph + caption) as a PNG.
 *
 * Deterministic and DOM-free: safe to call from a browser binding or from
 * the Node-hosted MCP tools. The caption is truncated with an ellipsis when
 * it would otherwise overflow the image width.
 */
export function renderOleIconPng(options: OleIconRasterOptions = {}): Uint8Array {
	const width = options.width ?? 128;
	const height = options.height ?? 96;
	const glyph = options.glyph ?? 'unknown';
	const caption = (options.caption ?? '').trim();

	const canvas = new RasterCanvas(width, height, rgb(255, 255, 255, 0));
	const glyphSize = Math.min(width * 0.5, height * 0.55);
	const glyphX = (width - glyphSize) / 2;
	const glyphY = height * 0.08;
	drawGlyph(canvas, glyph, glyphX, glyphY, glyphSize);

	if (caption.length > 0) {
		const scale = Math.max(1, Math.floor(width / 64));
		const maxTextWidth = width - 8;
		const text = RasterCanvas.truncateToWidth(caption, maxTextWidth, scale);
		const textWidth = RasterCanvas.measureText(text, scale);
		const textX = Math.max(0, (width - textWidth) / 2);
		const textY = glyphY + glyphSize + height * 0.06;
		canvas.drawText(text, textX, textY, CAPTION_COLOR, scale);
	}

	return encodePng(canvas.width, canvas.height, canvas.pixels);
}

/** Map a resolved OLE object type (see `ole-utils.ts`) onto an icon glyph. */
export function oleObjectTypeToGlyph(oleObjectType: string | undefined): OleIconGlyph {
	switch (oleObjectType) {
		case 'excel':
		case 'word':
		case 'powerpoint':
		case 'pdf':
		case 'visio':
		case 'mathtype':
			return oleObjectType;
		default:
			return 'unknown';
	}
}
