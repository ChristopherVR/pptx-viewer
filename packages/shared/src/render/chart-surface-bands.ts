/**
 * Isometric projection primitive, `c:bandFmts` colour-band resolution, and
 * `c:floor` / `c:sideWall` / `c:backWall` backdrop panels for the surface
 * chart's isometric SVG renderer ({@link ./chart-surface-treemap.ts}).
 *
 * Split out of `chart-surface-treemap.ts` to keep that file's two view-model
 * builders (isometric + flat) readable; everything here is pure geometry/
 * colour resolution with no view-model assembly of its own.
 *
 * @module chart-surface-bands
 */
import type { PptxChart3DSurface, PptxChartBandFmt } from 'pptx-viewer-core';

import type { SvgPolygon } from './chart-view-model';

export const ISO_COS30 = Math.cos(Math.PI / 6);
export const ISO_SIN30 = Math.sin(Math.PI / 6);

/** Project a 3-D (x, y, z) grid coordinate to 2-D isometric screen space. */
export function isoProject(x: number, y: number, z: number): { screenX: number; screenY: number } {
	return {
		screenX: (x - y) * ISO_COS30,
		screenY: (x + y) * ISO_SIN30 - z,
	};
}

/**
 * Resolve a surface facet's fill from `c:bandFmts` (discrete colour bands)
 * when authored, falling back to `undefined` so the caller uses the
 * continuous colour ramp instead.
 *
 * PowerPoint assigns bands from the value axis's major-unit intervals; this
 * renderer has no axis-tick model for a surface chart, so `bandFmts` (sorted
 * by `index`) is treated as N equal-width bands across the normalised
 * `[0, 1]` value range, which reproduces the common case (bands evenly
 * spaced end to end) without needing the authored major-unit spacing.
 */
export function resolveSurfaceBandFill(
	t: number,
	bandFmts: ReadonlyArray<PptxChartBandFmt> | undefined,
): string | undefined {
	if (!bandFmts || bandFmts.length === 0) {
		return undefined;
	}
	const sorted = [...bandFmts].sort((a, b) => a.index - b.index);
	const bucket = Math.min(sorted.length - 1, Math.max(0, Math.floor(t * sorted.length)));
	return sorted[bucket]?.spPr?.fillColor;
}

function wallPanel(
	corners: ReadonlyArray<[number, number, number]>,
	surface: PptxChart3DSurface | undefined,
	offsetX: number,
	offsetY: number,
): SvgPolygon | undefined {
	const fillColor = surface?.spPr?.fillColor;
	if (!fillColor) {
		return undefined;
	}
	const points = corners
		.map(([x, y, z]) => {
			const p = isoProject(x, y, z);
			return `${(p.screenX + offsetX).toFixed(2)},${(p.screenY + offsetY).toFixed(2)}`;
		})
		.join(' ');
	return {
		kind: 'polygon',
		points,
		fill: fillColor,
		stroke: surface.spPr?.strokeColor ?? 'none',
		strokeWidth: surface.spPr?.strokeWidth ?? 0,
	};
}

/** The three `c:chart`-level 3D surfaces the isometric renderer can paint. */
export interface SurfaceWallSources {
	floor?: PptxChart3DSurface;
	sideWall?: PptxChart3DSurface;
	backWall?: PptxChart3DSurface;
}

/**
 * Build the floor/back-wall/side-wall backdrop panels for the isometric
 * surface renderer, in back-to-front paint order (so the caller can prepend
 * them ahead of the mesh facets). Back wall and side wall meet at the far
 * (row=0, col=0) corner; the floor spans the whole footprint at z=0. Wall
 * height uses the fixed headroom (`zScale`) rather than the data height,
 * matching PowerPoint's static walls. Omits any panel whose surface has no
 * authored fill colour.
 */
export function buildSurfaceWallPanels(
	cols: number,
	rows: number,
	cellSize: number,
	zScale: number,
	offsetX: number,
	offsetY: number,
	surfaces: SurfaceWallSources,
): SvgPolygon[] {
	const backWall = wallPanel(
		[
			[0, 0, 0],
			[cols * cellSize, 0, 0],
			[cols * cellSize, 0, zScale],
			[0, 0, zScale],
		],
		surfaces.backWall,
		offsetX,
		offsetY,
	);
	const sideWall = wallPanel(
		[
			[0, 0, 0],
			[0, rows * cellSize, 0],
			[0, rows * cellSize, zScale],
			[0, 0, zScale],
		],
		surfaces.sideWall,
		offsetX,
		offsetY,
	);
	const floor = wallPanel(
		[
			[0, 0, 0],
			[cols * cellSize, 0, 0],
			[cols * cellSize, rows * cellSize, 0],
			[0, rows * cellSize, 0],
		],
		surfaces.floor,
		offsetX,
		offsetY,
	);
	return [backWall, sideWall, floor].filter((p): p is SvgPolygon => p !== undefined);
}
