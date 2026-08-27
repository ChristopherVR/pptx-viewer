/**
 * Background wall/floor panels for the 3D bar/line/area oblique-depth pass.
 *
 * `c:floor`, `c:sideWall`, and `c:backWall` (CT_Surface) are parsed onto
 * `PptxChartData.floor` / `.sideWall` / `.backWall` but, until this module,
 * never painted: a 3D cartesian chart authored with coloured walls rendered
 * with no walls at all. Each panel is a flat quadrilateral swept from the
 * plot's front bounding box to its back bounding box by the same oblique
 * depth vector ({@link ../chart-3d-depth.ts}) that offsets bar/line/area
 * extrusion, so the walls sit in the same illusion of depth as the marks
 * they frame.
 *
 * Deliberately additive and silent: a chart with no authored fill on a given
 * surface renders no panel for it, so an untouched chart's appearance is
 * unchanged. Only cartesian 3D kinds (bar3D/line3D/area3D) call this; pie3D
 * has no plot rectangle to wall in, matching PowerPoint's own behaviour.
 *
 * @module chart-3d-surfaces
 */
import type { PptxChart3DSurface } from 'pptx-viewer-core';

import type { DepthVector } from './chart-3d-depth';
import type { SvgPolygon, SvgPrimitive } from './chart-view-model';
import type { SurfaceWallColors } from './surface-chart-3d-walls';

/** The three `c:chart`-level 3D surfaces this module can paint. */
export interface Chart3DSurfaces {
	floor?: PptxChart3DSurface;
	sideWall?: PptxChart3DSurface;
	backWall?: PptxChart3DSurface;
}

/**
 * Resolve `c:floor`/`c:sideWall`/`c:backWall` fill colours into the shape the
 * WebGL scenes' wall-panel builder ({@link ../surface-chart-3d-walls.ts},
 * `buildSurfaceWallMeshes`) needs, or `undefined` when none of the three is
 * authored. Single parsing/resolution point for BOTH the flat oblique-depth
 * 2D wall panels ({@link build3DSurfacePanels}) and every interactive WebGL
 * chart scene (surface, bar3D, and future line3D/area3D), so a chart's walls
 * read identically across every presentation instead of each caller
 * re-reading `chartData.floor?.spPr?.fillColor` its own way.
 */
export function resolveChart3DWallColors(surfaces: Chart3DSurfaces): SurfaceWallColors | undefined {
	const floor = surfaces.floor?.spPr?.fillColor;
	const sideWall = surfaces.sideWall?.spPr?.fillColor;
	const backWall = surfaces.backWall?.spPr?.fillColor;
	if (!floor && !sideWall && !backWall) {
		return undefined;
	}
	return { floor, sideWall, backWall };
}

interface Bounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

/** Bounding box of the primitive kinds that carry plottable geometry (rect, polygon, polyline). */
export function primitivesBounds(prims: readonly SvgPrimitive[]): Bounds | undefined {
	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let found = false;

	const consider = (x: number, y: number): void => {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);
		found = true;
	};

	for (const prim of prims) {
		if (prim.kind === 'rect') {
			consider(prim.x, prim.y);
			consider(prim.x + prim.w, prim.y + prim.h);
		} else if (prim.kind === 'polygon' || prim.kind === 'polyline') {
			for (const pair of prim.points.trim().split(/\s+/u)) {
				const [x, y] = pair.split(',').map(Number);
				if (Number.isFinite(x) && Number.isFinite(y)) {
					consider(x, y);
				}
			}
		}
	}

	return found ? { minX, maxX, minY, maxY } : undefined;
}

function panel(
	points: readonly [number, number][],
	surface: PptxChart3DSurface | undefined,
): SvgPolygon | undefined {
	const fillColor = surface?.spPr?.fillColor;
	if (!fillColor) {
		return undefined;
	}
	return {
		kind: 'polygon',
		points: points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
		fill: fillColor,
		stroke: surface.spPr?.strokeColor ?? 'none',
		strokeWidth: surface.spPr?.strokeWidth ?? 0,
	};
}

/**
 * Build the floor/back-wall/side-wall background panels, furthest-back first
 * so callers can prepend them ahead of the per-mark extrusion. Returns an
 * empty array when none of the three surfaces has an authored fill colour,
 * or when there is no plottable geometry to frame.
 */
export function build3DSurfacePanels(
	prims: readonly SvgPrimitive[],
	surfaces: Chart3DSurfaces,
	depth: DepthVector,
): SvgPolygon[] {
	const bounds = primitivesBounds(prims);
	if (!bounds) {
		return [];
	}
	const { minX, maxX, minY, maxY } = bounds;
	const { dx, dy } = depth;

	const backWall = panel(
		[
			[minX + dx, minY + dy],
			[maxX + dx, minY + dy],
			[maxX + dx, maxY + dy],
			[minX + dx, maxY + dy],
		],
		surfaces.backWall,
	);
	const floor = panel(
		[
			[minX, maxY],
			[maxX, maxY],
			[maxX + dx, maxY + dy],
			[minX + dx, maxY + dy],
		],
		surfaces.floor,
	);
	const sideWall = panel(
		[
			[maxX, minY],
			[maxX + dx, minY + dy],
			[maxX + dx, maxY + dy],
			[maxX, maxY],
		],
		surfaces.sideWall,
	);

	return [backWall, floor, sideWall].filter((p): p is SvgPolygon => p !== undefined);
}
