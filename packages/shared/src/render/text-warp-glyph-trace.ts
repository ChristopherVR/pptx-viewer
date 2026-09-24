import { envelopeFontSizePx, toCanvasFont } from './text-warp-envelope-measure';
/**
 * Glyph outlines traced from the browser's own rendering, for WordArt
 * envelope glyphs whose font FILE is not obtainable (a system font with no
 * embedded copy and no catalogue webfont). The glyph is drawn large on an
 * offscreen canvas in exactly the CSS font an SVG `<text>` would use, and its
 * coverage raster is contoured at 50% (marching squares with sub-pixel
 * interpolation), so the result is the outline of the glyph the reader's
 * browser actually renders - the same glyph the `<text>` fallback would show
 * - and can be warped point by point like a parsed font outline.
 *
 * At {@link TRACE_SIZE_PX} the traced edge sits within a small fraction of a
 * raster pixel of the true outline (under 0.1% of the em), far below what is
 * visible after scaling back to slide size.
 */
import type { EnvelopeFontSpec } from './text-warp-envelope-types';
import type { GlyphOutlineCommand, OutlinePoint } from './text-warp-glyph-outline';
import { contourRaster } from './text-warp-glyph-trace-contour';

/** The font size glyphs are rasterised at for tracing. */
export const TRACE_SIZE_PX = 512;

/** Douglas-Peucker tolerance (raster px) applied to traced contours. */
const SIMPLIFY_PX = 0.2;

/** Raster padding around the glyph's ink box (px). */
const PAD = 3;

interface TracedGlyph {
	/** Contours in em units, origin at the glyph's baseline/left advance edge. */
	contours: OutlinePoint[][];
}

const traceCache = new Map<string, TracedGlyph | null>();
let traceCanvas: HTMLCanvasElement | null | undefined;

function getTraceContext(): CanvasRenderingContext2D | null {
	if (traceCanvas === undefined) {
		traceCanvas = typeof document === 'undefined' ? null : document.createElement('canvas');
	}
	return traceCanvas?.getContext('2d', { willReadFrequently: true }) ?? null;
}

function simplify(points: OutlinePoint[], tolerance: number): OutlinePoint[] {
	if (points.length < 4) {
		return points;
	}
	const keep = new Uint8Array(points.length);
	keep[0] = 1;
	keep[points.length - 1] = 1;
	const stack: [number, number][] = [[0, points.length - 1]];
	while (stack.length > 0) {
		const [a, b] = stack.pop() as [number, number];
		const pa = points[a];
		const pb = points[b];
		const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
		let worst = -1;
		let worstDist = tolerance;
		for (let i = a + 1; i < b; i++) {
			const p = points[i];
			const dist =
				len > 0
					? Math.abs((pb.x - pa.x) * (pa.y - p.y) - (pa.x - p.x) * (pb.y - pa.y)) / len
					: Math.hypot(p.x - pa.x, p.y - pa.y);
			if (dist > worstDist) {
				worst = i;
				worstDist = dist;
			}
		}
		if (worst >= 0) {
			keep[worst] = 1;
			stack.push([a, worst], [worst, b]);
		}
	}
	return points.filter((_, i) => keep[i] === 1);
}

function fontReady(font: string, char: string): boolean {
	const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
	if (!fonts || typeof fonts.check !== 'function') {
		return true;
	}
	try {
		return fonts.check(font, char);
	} catch {
		return true;
	}
}

function traceGlyph(char: string, font: EnvelopeFontSpec): TracedGlyph | null {
	const ctx = getTraceContext();
	if (!ctx || !traceCanvas) {
		return null;
	}
	const css = toCanvasFont(font, TRACE_SIZE_PX);
	ctx.font = css;
	const m = ctx.measureText(char);
	const left = Math.floor(-(m.actualBoundingBoxLeft ?? TRACE_SIZE_PX)) - PAD;
	const right = Math.ceil(m.actualBoundingBoxRight ?? TRACE_SIZE_PX * 2) + PAD;
	const top = Math.floor(-(m.actualBoundingBoxAscent ?? TRACE_SIZE_PX * 1.2)) - PAD;
	const bottom = Math.ceil(m.actualBoundingBoxDescent ?? TRACE_SIZE_PX * 0.5) + PAD;
	const w = right - left;
	const h = bottom - top;
	if (!(w > 0 && h > 0 && w < TRACE_SIZE_PX * 8 && h < TRACE_SIZE_PX * 8)) {
		return null;
	}
	traceCanvas.width = w;
	traceCanvas.height = h;
	ctx.clearRect(0, 0, w, h);
	ctx.font = css;
	ctx.fillStyle = '#000';
	ctx.textBaseline = 'alphabetic';
	ctx.fillText(char, -left, -top);
	const data = ctx.getImageData(0, 0, w, h).data;
	const alpha = new Float32Array(w * h);
	for (let i = 0; i < w * h; i++) {
		alpha[i] = data[i * 4 + 3] / 255;
	}
	const contours = contourRaster(alpha, w, h, 0.5).map((contour) =>
		simplify(contour, SIMPLIFY_PX).map((p) => ({
			// Raster pixel centres sit at +0.5; shift back to glyph space.
			x: (p.x + 0.5 + left) / TRACE_SIZE_PX,
			y: (p.y + 0.5 + top) / TRACE_SIZE_PX,
		})),
	);
	return { contours: contours.filter((c) => c.length >= 3) };
}

/**
 * The traced outline of `char` in `font`, positioned at `(x, y)` (baseline
 * origin) and scaled to the font's size. Returns `undefined` when tracing is
 * unavailable (no DOM canvas), `[]` for a glyph with no ink.
 */
export function traceGlyphOutlineCommands(
	char: string,
	font: EnvelopeFontSpec,
	x: number,
	y: number,
): GlyphOutlineCommand[] | undefined {
	const css = toCanvasFont(font, TRACE_SIZE_PX);
	const key = `${css}|${char}`;
	let traced = traceCache.get(key);
	if (traced === undefined) {
		traced = traceGlyph(char, font);
		// A webfont still loading traces its fallback face: use it for this
		// render (it is what a `<text>` would show too) but do not cache it.
		if (traced === null || fontReady(css, char)) {
			traceCache.set(key, traced);
		}
	}
	if (!traced) {
		return undefined;
	}
	const scale = envelopeFontSizePx(font);
	const commands: GlyphOutlineCommand[] = [];
	for (const contour of traced.contours) {
		contour.forEach((p, i) => {
			commands.push({ type: i === 0 ? 'M' : 'L', x: x + p.x * scale, y: y + p.y * scale });
		});
		commands.push({ type: 'Z' });
	}
	return commands;
}

/** Test hook: forget traced glyphs and the tracing canvas. */
export function resetGlyphTraceCache(): void {
	traceCache.clear();
	traceCanvas = undefined;
}
