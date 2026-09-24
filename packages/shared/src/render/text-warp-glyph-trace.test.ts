// @vitest-environment jsdom
/**
 * `text-warp-glyph-trace` tests: the canvas is stubbed so a "glyph" is a
 * solid rectangle of known raster extent, and the traced outline must come
 * back in glyph space scaled to the requested font size.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { outlineBounds } from './text-warp-glyph-outline';
import {
	resetGlyphTraceCache,
	TRACE_SIZE_PX,
	traceGlyphOutlineCommands,
} from './text-warp-glyph-trace';

const FONT = { fontFamily: 'NoFileFont', fontSizePx: 20 };

/** Ink from x in [0, 0.5em) and y in (-0.75em, 0] around the origin. */
function stubCanvas(): void {
	let width = 0;
	let height = 0;
	let originX = 0;
	let originY = 0;
	const ctx = {
		font: '',
		fillStyle: '',
		textBaseline: '',
		measureText: () => ({
			width: TRACE_SIZE_PX / 2,
			actualBoundingBoxLeft: 0,
			actualBoundingBoxRight: TRACE_SIZE_PX / 2,
			actualBoundingBoxAscent: (TRACE_SIZE_PX * 3) / 4,
			actualBoundingBoxDescent: 0,
		}),
		clearRect: () => undefined,
		fillText: (_c: string, x: number, y: number) => {
			originX = x;
			originY = y;
		},
		getImageData: () => {
			const data = new Uint8ClampedArray(width * height * 4);
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const gx = x + 0.5 - originX;
					const gy = y + 0.5 - originY;
					const inside =
						gx > 0 && gx < TRACE_SIZE_PX / 2 && gy > (-TRACE_SIZE_PX * 3) / 4 && gy < 0;
					data[(y * width + x) * 4 + 3] = inside ? 255 : 0;
				}
			}
			return { data };
		},
	};
	const canvas = {
		get width() {
			return width;
		},
		set width(v: number) {
			width = v;
		},
		get height() {
			return height;
		},
		set height(v: number) {
			height = v;
		},
		getContext: () => ctx,
	};
	vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLElement);
}

afterEach(() => {
	vi.restoreAllMocks();
	resetGlyphTraceCache();
});

describe('traceGlyphOutlineCommands', () => {
	it('is undefined without a canvas context', () => {
		vi.spyOn(document, 'createElement').mockReturnValue({
			getContext: () => null,
		} as unknown as HTMLElement);
		expect(traceGlyphOutlineCommands('A', FONT, 0, 0)).toBeUndefined();
	});

	it('traces the rendered ink, scaled to the font size and placed at the origin', () => {
		stubCanvas();
		const commands = traceGlyphOutlineCommands('A', FONT, 100, 50)!;
		const bounds = outlineBounds(commands)!;
		const tolerance = 20 / TRACE_SIZE_PX;
		expect(Math.abs(bounds.left - 100)).toBeLessThan(tolerance);
		expect(Math.abs(bounds.right - 110)).toBeLessThan(tolerance);
		expect(Math.abs(bounds.top - (50 - 15))).toBeLessThan(tolerance);
		expect(Math.abs(bounds.bottom - 50)).toBeLessThan(tolerance);
		expect(commands.at(-1)).toStrictEqual({ type: 'Z' });
	});
});
