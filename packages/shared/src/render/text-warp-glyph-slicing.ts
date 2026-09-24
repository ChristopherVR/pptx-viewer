/**
 * Affine / piecewise-affine fallback for a WordArt envelope glyph whose
 * outline is not obtainable (no font file and no DOM canvas to trace the
 * browser's own rendering with, e.g. server-side rendering or a test
 * environment). With an outline available, `text-warp-glyph-outline.ts`
 * warps it exactly instead and none of this runs.
 *
 * The glyph renders as an SVG `<text>` at its unwarped layout position, with
 * a full `matrix(a b c d e f)` least-squares fit of the envelope mapping
 * (`text-warp-envelope-map.ts`) over its ink box. When one affine misses the
 * mapping by more than {@link SLICE_TOLERANCE_FRACTION} of the shape box
 * height anywhere inside the glyph box
 * (a wide glyph on a strongly curved envelope), the glyph is split into up
 * to {@link MAX_ENVELOPE_GLYPH_SLICES} vertical bands, each clipped to its
 * own x-range (in the same pre-transform layout space `x`/`y` are in) and
 * carrying its own fit, so the pieces tile the glyph.
 */
import type { EnvelopeWarp } from './text-warp-envelope-map';

/** Never split a single glyph into more than this many rendered pieces. */
export const MAX_ENVELOPE_GLYPH_SLICES = 24;

/**
 * Largest acceptable miss between a piece's affine and the true mapping, as
 * a fraction of the shape box height (never below half a pixel).
 */
const SLICE_TOLERANCE_FRACTION = 0.005;
const MIN_SLICE_TOLERANCE_PX = 0.5;

/** Grid resolution (per axis) the affine fit and its error are measured on. */
const FIT_GRID = 5;

/** How far past a glyph's outer ink edge its outermost clip rects reach. */
const CLIP_OVERHANG = 100000;

/** One rendered piece of a glyph: clipped to its own x-band, its own affine fit. */
export interface EnvelopeGlyphSlice {
	/** Left edge of this slice's clip rect, in the glyph's own (pre-transform) x. */
	clipX0: number;
	/** Right edge of this slice's clip rect, in the glyph's own (pre-transform) x. */
	clipX1: number;
	/** SVG `matrix(a b c d e f)` fit of the envelope mapping over this slice. */
	transform: string;
}

/** The rectangle (layout units) an affine fit covers. */
export interface GlyphFitBox {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}

type Affine = [number, number, number, number, number, number];

/** Solve the 3x3 system `m * p = r` by Cramer's rule (`undefined` when singular). */
function solve3(m: number[][], r: number[]): [number, number, number] | undefined {
	const det = (a: number[][]): number =>
		a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
		a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
		a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
	const d = det(m);
	if (Math.abs(d) < 1e-12) {
		return undefined;
	}
	const col = (i: number): number[][] => m.map((row, k) => row.map((v, j) => (j === i ? r[k] : v)));
	return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

interface FitResult {
	affine: Affine;
	error: number;
}

/** Least-squares affine of `warp` over `box`, plus its worst miss on the grid. */
function fitAffine(warp: EnvelopeWarp, box: GlyphFitBox): FitResult {
	const src: [number, number][] = [];
	const dst: { x: number; y: number }[] = [];
	for (let i = 0; i < FIT_GRID; i++) {
		for (let j = 0; j < FIT_GRID; j++) {
			const x = box.x0 + ((box.x1 - box.x0) * i) / (FIT_GRID - 1);
			const y = box.y0 + ((box.y1 - box.y0) * j) / (FIT_GRID - 1);
			src.push([x, y]);
			dst.push(warp.map(x, y));
		}
	}
	const n = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0],
	];
	const rx = [0, 0, 0];
	const ry = [0, 0, 0];
	src.forEach(([x, y], k) => {
		const v = [x, y, 1];
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 3; j++) {
				n[i][j] += v[i] * v[j];
			}
			rx[i] += v[i] * dst[k].x;
			ry[i] += v[i] * dst[k].y;
		}
	});
	const px = solve3(n, rx);
	const py = solve3(n, ry);
	if (!px || !py) {
		const c = warp.map((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2);
		return { affine: [1, 0, 0, 1, c.x, c.y], error: 0 };
	}
	// SVG `matrix(a b c d e f)`: x' = a x + c y + e, y' = b x + d y + f.
	const affine: Affine = [px[0], py[0], px[1], py[1], px[2], py[2]];
	let error = 0;
	src.forEach(([x, y], k) => {
		const fx = affine[0] * x + affine[2] * y + affine[4];
		const fy = affine[1] * x + affine[3] * y + affine[5];
		error = Math.max(error, Math.hypot(fx - dst[k].x, fy - dst[k].y));
	});
	return { affine, error };
}

function formatMatrix(m: Affine): string {
	return `matrix(${m.map((v) => (Number.isFinite(v) ? v : 0)).join(' ')})`;
}

/** A glyph's single-affine transform plus, when one affine is not enough, its slices. */
export interface GlyphAffineFit {
	transform: string;
	slices?: EnvelopeGlyphSlice[];
}

/**
 * Fit the envelope mapping over a glyph's ink `box`, slicing it into
 * vertical bands when a single affine misses by more than the tolerance.
 */
export function fitGlyphEnvelopeAffine(
	warp: EnvelopeWarp,
	box: GlyphFitBox,
	shapeHeight = 0,
): GlyphAffineFit {
	const tolerance = Math.max(MIN_SLICE_TOLERANCE_PX, shapeHeight * SLICE_TOLERANCE_FRACTION);
	const whole = fitAffine(warp, box);
	const transform = formatMatrix(whole.affine);
	if (whole.error <= tolerance || !(box.x1 > box.x0)) {
		return { transform };
	}
	let pieces: FitResult[] = [];
	let count = 2;
	for (; count <= MAX_ENVELOPE_GLYPH_SLICES; count++) {
		const step = (box.x1 - box.x0) / count;
		pieces = Array.from({ length: count }, (_, i) =>
			fitAffine(warp, { ...box, x0: box.x0 + step * i, x1: box.x0 + step * (i + 1) }),
		);
		if (pieces.every((p) => p.error <= tolerance)) {
			break;
		}
	}
	const n = pieces.length;
	const step = (box.x1 - box.x0) / n;
	return {
		transform,
		slices: pieces.map((p, i) => ({
			clipX0: i === 0 ? box.x0 - CLIP_OVERHANG : box.x0 + step * i,
			clipX1: i === n - 1 ? box.x1 + CLIP_OVERHANG : box.x0 + step * (i + 1),
			transform: formatMatrix(p.affine),
		})),
	};
}
