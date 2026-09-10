/**
 * Detects the host browser's actual maximum canvas dimension so large raster
 * exports can be tiled (see `export-tile-plan`) instead of silently
 * producing a blank or truncated image.
 *
 * Browsers do not expose their canvas size cap directly, and exceeding it is
 * not guaranteed to throw: some implementations clamp the canvas to a
 * smaller backing size and quietly return blank pixels for anything drawn
 * past it. The only reliable way to find the real cap is to draw a marker
 * pixel near a candidate edge and read it back.
 *
 * Re-exported (cached) from `../export/canvas-size-probe.ts` for callers in
 * that directory; this is the implementation.
 */

/** A minimal canvas-like surface, duck-typed so tests can inject a fake. */
export interface ProbeCanvas {
	width: number;
	height: number;
	getContext(id: '2d'): ProbeCanvasContext | null;
}

/** The subset of `CanvasRenderingContext2D` the probe needs. */
export interface ProbeCanvasContext {
	// Widened to match `CanvasRenderingContext2D.fillStyle`'s real (get/set)
	// type: a plain `string` here makes the real 2D context structurally
	// incompatible with this interface (its getter can return a
	// `CanvasGradient`/`CanvasPattern`), so the default factory below would
	// fail to type-check even though only string assignment is ever used.
	fillStyle: string | CanvasGradient | CanvasPattern;
	fillRect(x: number, y: number, w: number, h: number): void;
	getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> };
}

/** Injectable canvas factory, defaults to `document.createElement('canvas')`. */
export type CanvasFactory = (width: number, height: number) => ProbeCanvas;

/**
 * Candidate maximum dimensions to probe, largest first, drawn from documented
 * real-world caps: Chromium (~65,535 in theory but practically tested up to
 * 16,384 reliably), older WebKit (~4,096-8,192), Firefox (~11,180, the
 * largest square whose area fits a 32-bit index).
 */
export const CANVAS_DIMENSION_CANDIDATES: readonly number[] = [
	16384, 14188, 11180, 8192, 4096, 2048,
];

const MARKER = { r: 17, g: 187, b: 221, a: 255 } as const;

function canvasReportsMarker(
	factory: CanvasFactory,
	dim: number,
): { ok: boolean; probeFailed: boolean } {
	try {
		// A 1px-tall strip is enough to prove the browser honours `dim` as a
		// width without allocating `dim * dim` pixels of backing store.
		const canvas = factory(dim, 1);
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return { ok: false, probeFailed: true };
		}
		ctx.fillStyle = `rgba(${MARKER.r},${MARKER.g},${MARKER.b},1)`;
		ctx.fillRect(dim - 1, 0, 1, 1);
		const pixel = ctx.getImageData(dim - 1, 0, 1, 1).data;
		const ok = pixel[0] === MARKER.r && pixel[1] === MARKER.g && pixel[2] === MARKER.b;
		return { ok, probeFailed: false };
	} catch {
		return { ok: false, probeFailed: false };
	}
}

/**
 * Probe candidate dimensions (largest first) and return the largest one the
 * browser actually honours. Falls back to the smallest candidate if every
 * probe fails outright (e.g. no 2D context available at all, such as in a
 * DOM-less test environment), so callers always get a usable, conservative
 * number rather than `undefined`.
 *
 * @param factory - Canvas constructor, injectable for testing. Defaults to
 *                   `document.createElement('canvas')`.
 */
export function probeMaxCanvasDimension(
	factory: CanvasFactory = (w, h) => {
		const el = document.createElement('canvas');
		el.width = w;
		el.height = h;
		return el;
	},
): number {
	for (const dim of CANVAS_DIMENSION_CANDIDATES) {
		const { ok, probeFailed } = canvasReportsMarker(factory, dim);
		if (ok) {
			return dim;
		}
		if (probeFailed) {
			break;
		}
	}
	return CANVAS_DIMENSION_CANDIDATES[CANVAS_DIMENSION_CANDIDATES.length - 1];
}

let cachedMaxDim: number | undefined;

/**
 * Cached wrapper around {@link probeMaxCanvasDimension}: the cap is a
 * property of the browser/GPU, not of any particular export, so probing once
 * per session (a handful of tiny canvas allocations) is enough. Exported
 * separately so tests can reset the cache between runs.
 */
export function getMaxCanvasDimension(factory?: CanvasFactory): number {
	if (cachedMaxDim === undefined) {
		cachedMaxDim = probeMaxCanvasDimension(factory);
	}
	return cachedMaxDim;
}

/** Test-only: clear the memoised probe result. */
export function _resetCanvasDimensionCache(): void {
	cachedMaxDim = undefined;
}
