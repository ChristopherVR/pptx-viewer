/**
 * Tiny DOM-free raster canvas: an RGBA pixel buffer plus rect / line / text
 * primitives, backing the OLE icon-caption and content-preview regeneration
 * (`ole-icon-raster.ts`, `ole-content-preview-raster.ts`). Runs identically
 * in the browser and in Node (MCP tools), which rules out `<canvas>` /
 * `OffscreenCanvas`.
 *
 * Text uses a built-in 5x7 bitmap font covering ASCII 0x20-0x7E; anything
 * outside that range renders as a placeholder box glyph so a caption never
 * silently disappears.
 *
 * @module raster-canvas
 */

/** RGBA colour as four 0-255 bytes. */
export interface RasterColor {
	r: number;
	g: number;
	b: number;
	a: number;
}

export function rgb(r: number, g: number, b: number, a = 255): RasterColor {
	return { r, g, b, a };
}

/**
 * 5x7 bitmap font, one 5-bit row per scanline (bit 4 = leftmost pixel).
 * Covers digits, uppercase, lowercase, and common punctuation, enough for a
 * PowerPoint object-name caption. Codepoints not present fall back to a solid
 * placeholder block.
 */
const FONT_5X7: Record<string, number[]> = {
	' ': [0, 0, 0, 0, 0, 0, 0],
	'.': [0, 0, 0, 0, 0, 0b010, 0],
	',': [0, 0, 0, 0, 0, 0b010, 0b100],
	'-': [0, 0, 0, 0b1110, 0, 0, 0],
	_: [0, 0, 0, 0, 0, 0, 0b11111],
	':': [0, 0b010, 0, 0, 0, 0b010, 0],
	'0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
	'1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
	'2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
	'3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
	'4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
	'5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
	'6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
	'7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
	'8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
	'9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
	A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
	B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
	C: [0b01111, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b01111],
	D: [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
	E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
	F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
	G: [0b01111, 0b10000, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
	H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
	I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
	J: [0b00001, 0b00001, 0b00001, 0b00001, 0b10001, 0b10001, 0b01110],
	K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
	L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
	M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
	N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
	O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
	P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
	Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
	R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
	S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
	T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
	U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
	V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
	W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
	X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
	Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
	Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
};

/** Fold lowercase and digits/punctuation onto the uppercase glyph set. */
function glyphRowsFor(char: string): number[] {
	const upper = char.toUpperCase();
	return (
		FONT_5X7[char] ??
		FONT_5X7[upper] ?? [0b11111, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11111]
	);
}

/** A DOM-free RGBA canvas with basic drawing primitives. */
export class RasterCanvas {
	public readonly width: number;
	public readonly height: number;
	public readonly pixels: Uint8ClampedArray;

	public constructor(width: number, height: number, background: RasterColor) {
		this.width = Math.max(1, Math.round(width));
		this.height = Math.max(1, Math.round(height));
		this.pixels = new Uint8ClampedArray(this.width * this.height * 4);
		this.fillRect(0, 0, this.width, this.height, background);
	}

	private setPixel(x: number, y: number, color: RasterColor): void {
		if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
			return;
		}
		const idx = (y * this.width + x) * 4;
		if (color.a >= 255) {
			this.pixels[idx] = color.r;
			this.pixels[idx + 1] = color.g;
			this.pixels[idx + 2] = color.b;
			this.pixels[idx + 3] = 255;
			return;
		}
		// Simple alpha-over compositing against the existing pixel.
		const alpha = color.a / 255;
		this.pixels[idx] = Math.round(color.r * alpha + this.pixels[idx]! * (1 - alpha));
		this.pixels[idx + 1] = Math.round(color.g * alpha + this.pixels[idx + 1]! * (1 - alpha));
		this.pixels[idx + 2] = Math.round(color.b * alpha + this.pixels[idx + 2]! * (1 - alpha));
		this.pixels[idx + 3] = Math.round(255 * alpha + this.pixels[idx + 3]! * (1 - alpha));
	}

	public fillRect(x: number, y: number, w: number, h: number, color: RasterColor): void {
		const x0 = Math.max(0, Math.floor(x));
		const y0 = Math.max(0, Math.floor(y));
		const x1 = Math.min(this.width, Math.ceil(x + w));
		const y1 = Math.min(this.height, Math.ceil(y + h));
		for (let py = y0; py < y1; py++) {
			for (let px = x0; px < x1; px++) {
				this.setPixel(px, py, color);
			}
		}
	}

	public strokeRect(
		x: number,
		y: number,
		w: number,
		h: number,
		color: RasterColor,
		lineWidth = 1,
	): void {
		this.fillRect(x, y, w, lineWidth, color);
		this.fillRect(x, y + h - lineWidth, w, lineWidth, color);
		this.fillRect(x, y, lineWidth, h, color);
		this.fillRect(x + w - lineWidth, y, lineWidth, h, color);
	}

	public drawLine(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		color: RasterColor,
		lineWidth = 1,
	): void {
		const dx = x2 - x1;
		const dy = y2 - y1;
		const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
		for (let i = 0; i <= steps; i++) {
			const x = x1 + (dx * i) / steps;
			const y = y1 + (dy * i) / steps;
			this.fillRect(x - lineWidth / 2, y - lineWidth / 2, lineWidth, lineWidth, color);
		}
	}

	/** Draw text at (x, y) as the top-left corner, scaled by `scale` (default 1 = 5x7px per glyph). */
	public drawText(text: string, x: number, y: number, color: RasterColor, scale = 1): void {
		let cursorX = x;
		for (const char of text) {
			const rows = glyphRowsFor(char);
			for (let row = 0; row < rows.length; row++) {
				const bits = rows[row]!;
				for (let col = 0; col < 5; col++) {
					if ((bits >> (4 - col)) & 1) {
						this.fillRect(cursorX + col * scale, y + row * scale, scale, scale, color);
					}
				}
			}
			cursorX += 6 * scale;
		}
	}

	/** Measured pixel width of `text` at the given scale, matching {@link drawText}. */
	public static measureText(text: string, scale = 1): number {
		return Math.max(0, text.length * 6 * scale - scale);
	}

	/** Truncate `text` with a trailing ellipsis so it fits within `maxWidth` px at `scale`. */
	public static truncateToWidth(text: string, maxWidth: number, scale = 1): string {
		if (RasterCanvas.measureText(text, scale) <= maxWidth) {
			return text;
		}
		const ellipsis = '...';
		let result = text;
		while (result.length > 0 && RasterCanvas.measureText(result + ellipsis, scale) > maxWidth) {
			result = result.slice(0, -1);
		}
		return result.length > 0 ? result + ellipsis : ellipsis;
	}
}
