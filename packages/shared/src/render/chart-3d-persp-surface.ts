/**
 * The 3-D Surface chart (`c:surface3DChart`, and `c:surfaceChart` under the
 * 3D opt-in) on the perspective box (`chart-3d-persp-layout.ts`), as pure
 * geometry: PowerPoint colours a surface by VALUE BAND, one band per major
 * unit of the value axis (`gt/chart-16,17`: bands 0-0.5, 0.5-1, ... each in
 * its own colour, listed in the legend in place of the series).
 *
 * - The surface is a grid over categories (x) and series (z), series 1 on the
 *   front edge and the last on the back wall. Each grid cell is split into two
 *   triangles and each triangle clipped into the bands it crosses.
 * - Band colours come from `c:bandFmts` (fill, or the line colour of a
 *   wireframe), else the chart palette cycle PowerPoint uses (accents 1-6,
 *   then the same at 60% luminance).
 * - `c:wireframe` draws, for every band, the grid of the surface clamped
 *   into that band in the band's colour (so a band the surface rises through
 *   shows as a flat grid at its top edge), instead of fills.
 *
 * @module chart-3d-persp-surface
 */
import type { PptxChartData } from 'pptx-viewer-core';

import type { PerspChartLayout } from './chart-3d-persp-layout';
import { perspValueY } from './chart-3d-persp-marks';
import { shade } from './chart-palette';

type Vec3 = [number, number, number];

export interface SurfaceBand {
	/** Legend text, e.g. `0-0.5`. */
	label: string;
	color: string;
}

export interface SurfaceGeometry {
	bands: SurfaceBand[];
	/** Filled triangles as box-space vertex triples, with each triangle's band. */
	triangles: Array<{ points: [Vec3, Vec3, Vec3]; band: number }>;
	/** Wireframe segments with each piece's band. */
	segments: Array<{ from: Vec3; to: Vec3; band: number }>;
}

type LayoutCore = Pick<PerspChartLayout, 'view' | 'range' | 'valueScale' | 'categoryX'>;

/** Box z of series row `s` of `n` (front edge to back wall). */
export function surfaceRowZ(layout: Pick<LayoutCore, 'view'>, s: number, n: number): number {
	return n > 1 ? (s / (n - 1)) * layout.view.box.d : layout.view.box.d / 2;
}

/** The value band edges (min, min + unit, ..., max). */
function bandEdges(range: LayoutCore['range']): number[] {
	const unit = range.majorUnit > 0 ? range.majorUnit : range.max - range.min || 1;
	const edges: number[] = [];
	for (let v = range.min; v < range.max - unit * 1e-9; v += unit) {
		edges.push(Number(v.toPrecision(12)));
	}
	edges.push(range.max);
	return edges;
}

function formatEdge(v: number): string {
	return String(Number(v.toPrecision(10)));
}

/** Colours and legend labels for each band. */
export function surfaceBands(
	chartData: PptxChartData,
	range: LayoutCore['range'],
	palette: readonly string[],
): SurfaceBand[] {
	const edges = bandEdges(range);
	return edges.slice(0, -1).map((lo, i) => {
		const fmt = chartData.bandFmts?.find((b) => b.index === i)?.spPr;
		const cycle = palette.length > 0 ? palette : ['#4472C4'];
		const base = cycle[i % cycle.length];
		const fallback = Math.floor(i / cycle.length) % 2 === 1 ? shade(base, 0.4) : base;
		return {
			label: `${formatEdge(lo)}-${formatEdge(edges[i + 1])}`,
			color: fmt?.fillColor ?? fmt?.strokeColor ?? fallback,
		};
	});
}

/** Clip a polygon to `lo <= y <= hi` (box y). */
function clipY(poly: Vec3[], lo: number, hi: number): Vec3[] {
	const clip = (pts: Vec3[], keep: (p: Vec3) => boolean, edge: number): Vec3[] => {
		const out: Vec3[] = [];
		for (let i = 0; i < pts.length; i++) {
			const a = pts[i];
			const b = pts[(i + 1) % pts.length];
			const ina = keep(a);
			const inb = keep(b);
			if (ina) {
				out.push(a);
			}
			if (ina !== inb) {
				const t = (edge - a[1]) / (b[1] - a[1]);
				out.push([a[0] + (b[0] - a[0]) * t, edge, a[2] + (b[2] - a[2]) * t]);
			}
		}
		return out;
	};
	return clip(
		clip(poly, (p) => p[1] >= lo, lo),
		(p) => p[1] <= hi,
		hi,
	);
}

/** A grid cell's two triangles. */
function cellTriangles(
	point: (s: number, c: number) => Vec3,
	s: number,
	c: number,
): Array<[Vec3, Vec3, Vec3]> {
	return [
		[point(s, c), point(s, c + 1), point(s + 1, c + 1)],
		[point(s, c), point(s + 1, c + 1), point(s + 1, c)],
	];
}

/**
 * A grid edge drawn once per band with the surface clamped into that band
 * (PowerPoint's wireframe: each band is its own layer, flat where the
 * surface runs above or below it). Only the front series line keeps its
 * flat stretches: that is all `gt/chart-17` shows of the lower layers.
 */
function clampedBandSegments(
	a: Vec3,
	b: Vec3,
	edgesY: number[],
	out: SurfaceGeometry['segments'],
	keepFlat: boolean,
): void {
	for (let band = 0; band + 1 < edgesY.length; band++) {
		const lo = edgesY[band];
		const hi = edgesY[band + 1];
		const cuts = [0, 1];
		for (const e of [lo, hi]) {
			const t = (e - a[1]) / (b[1] - a[1]);
			if (t > 0 && t < 1) {
				cuts.push(t);
			}
		}
		cuts.sort((x, y) => x - y);
		const at = (t: number): Vec3 => [
			a[0] + (b[0] - a[0]) * t,
			Math.min(hi, Math.max(lo, a[1] + (b[1] - a[1]) * t)),
			a[2] + (b[2] - a[2]) * t,
		];
		for (let i = 0; i + 1 < cuts.length; i++) {
			const from = at(cuts[i]);
			const to = at(cuts[i + 1]);
			const flat = from[1] === to[1] && (from[1] === lo || from[1] === hi);
			if (keepFlat || !flat) {
				out.push({ from, to, band });
			}
		}
	}
}

/**
 * The surface's triangles (filled) or segments (wireframe) in box space;
 * `override` replaces one point's value (a drag preview).
 */
export function buildSurfaceGeometry(
	chartData: PptxChartData,
	layout: LayoutCore,
	palette: readonly string[],
	override?: { seriesIndex: number; pointIndex: number; value: number },
): SurfaceGeometry {
	const nSer = chartData.series.length;
	const nCat = layout.categoryX.length;
	const bands = surfaceBands(chartData, layout.range, palette);
	const edgesY = bandEdges(layout.range).map((v) => perspValueY(layout, v));
	const point = (s: number, c: number): Vec3 => {
		let v = chartData.series[s]?.values[c];
		if (override && override.seriesIndex === s && override.pointIndex === c) {
			v = override.value;
		}
		const value = v !== undefined && Number.isFinite(v) ? v : layout.range.min;
		return [layout.categoryX[c], perspValueY(layout, value), surfaceRowZ(layout, s, nSer)];
	};
	const geometry: SurfaceGeometry = { bands, triangles: [], segments: [] };
	if (chartData.wireframe) {
		for (let s = 0; s < nSer; s++) {
			for (let c = 0; c < nCat; c++) {
				if (c + 1 < nCat) {
					clampedBandSegments(point(s, c), point(s, c + 1), edgesY, geometry.segments, s === 0);
				}
				if (s + 1 < nSer) {
					clampedBandSegments(point(s, c), point(s + 1, c), edgesY, geometry.segments, false);
				}
			}
		}
		return geometry;
	}
	for (let s = 0; s + 1 < nSer; s++) {
		for (let c = 0; c + 1 < nCat; c++) {
			for (const tri of cellTriangles(point, s, c)) {
				for (let b = 0; b < bands.length; b++) {
					const piece = clipY(tri, edgesY[b], edgesY[b + 1]);
					for (let i = 1; i + 1 < piece.length; i++) {
						geometry.triangles.push({ points: [piece[0], piece[i], piece[i + 1]], band: b });
					}
				}
			}
		}
	}
	return geometry;
}
